import { LoginForm } from "@/components/intelligence/login";
export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in · Axiom Intelligence OS" };
export default function Login() {
  return (
    <LoginForm
      demo={
        process.env.AXIOM_MODE === "demo" &&
        process.env.AXIOM_DEMO_LOGIN === "true"
      }
      oidc={!!process.env.OIDC_ISSUER}
    />
  );
}
