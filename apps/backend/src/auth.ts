import NextAuth, { type DefaultSession } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { prisma } from "@/server/database/prisma";
import { verifyPassword } from "@/server/auth/utils/password";
import { loginSchema } from "@/server/auth/validators/authSchemas";
import { rateLimiter } from "@/server/security/rateLimiter";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      emailVerified: Date | null;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  cookies: {
    sessionToken: {
      name: "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  events: {
    async createUser({ user }) {
      // Auto-provision personal workspace for Google OAuth users
      const email = user.email || "user";
      const name = user.name || "User";
      const workspaceSlug = `${email.split("@")[0].replace(/[^a-z0-9]/g, "-")}-${Date.now().toString(36)}`;
      
      const workspace = await prisma.workspace.create({
        data: {
          name: `${name.trim()}'s Workspace`,
          slug: workspaceSlug,
        },
      });

      await prisma.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id as string,
          role: "OWNER",
        },
      });
    },
  },
  providers: [
    // 1. Google Identity Provider (for SaaS user sign-in only)
    Google({
      clientId: process.env.AUTH_GOOGLE_ID || "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET || "",
      allowDangerousEmailAccountLinking: false, // Prevents insecure account takeover
    }),

    // 2. Email & Password Credentials Provider
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Validate payload shape
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const email = parsed.data.email.trim().toLowerCase();
        const password = parsed.data.password;

        // Rate limiting: 5 failed attempts per 15 minutes per email/IP
        const rateLimitKey = `login-attempt:${email}`;
        if (rateLimiter.isRateLimited(rateLimitKey, 5, 15 * 60 * 1000)) {
          throw new Error("Too many login attempts. Please try again in 15 minutes.");
        }

        // Retrieve user
        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.passwordHash) {
          // Generic failure to prevent user enumeration
          return null;
        }

        // Verify Argon2id hash
        const isValid = await verifyPassword(password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        // Reset rate limiter on successful login
        rateLimiter.reset(rateLimitKey);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role || "USER";
      }

      // If user profile is updated in session
      if (trigger === "update" && session) {
        token.name = session.name ?? token.name;
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string) || "USER";
      }
      return session;
    },
  },
  secret: process.env.AUTH_SECRET,
});
