import type { AuthService } from "./auth-service";
import { AuthValidationError } from "./auth-service";
import { CognitoAuthAdapter } from "./cognito-auth-adapter";

function isSupabaseUser(value: unknown): value is { id: string; email: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof (value as { id: unknown }).id === "string" &&
    "email" in value &&
    typeof (value as { email: unknown }).email === "string"
  );
}

export function createAuthService(): AuthService {
  const provider = process.env.AUTH_PROVIDER || "cognito";

  switch (provider) {
    case "cognito": {
      const poolId = process.env.COGNITO_USER_POOL_ID;
      const clientId = process.env.COGNITO_CLIENT_ID;
      if (!poolId || !clientId) {
        throw new Error("COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID must be set");
      }
      return new CognitoAuthAdapter(poolId, clientId);
    }
    case "supabase": {
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) {
        throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
      }
      return {
        async validateToken(token: string) {
          const response = await fetch(`${url}/auth/v1/user`, {
            headers: { Authorization: `Bearer ${token}`, apikey: key },
          });
          if (!response.ok) {
            throw new AuthValidationError("Invalid or expired token");
          }
          const user: unknown = await response.json();
          if (!isSupabaseUser(user)) {
            throw new AuthValidationError("Unexpected Supabase user response shape");
          }
          return { providerUserId: user.id, email: user.email, provider: "supabase" };
        },
      };
    }
    default:
      throw new Error(`Unknown AUTH_PROVIDER: ${provider}`);
  }
}
