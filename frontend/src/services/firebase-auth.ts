const FIREBASE_AUTH_BASE_URL = "https://identitytoolkit.googleapis.com/v1";
const FIREBASE_REFRESH_URL = "https://securetoken.googleapis.com/v1/token";

export interface FirebaseAuthTokens {
  idToken: string;
  refreshToken: string;
  email: string;
  localId: string;
  expiresAt: number;
}

interface FirebaseAuthResponse {
  idToken: string;
  refreshToken: string;
  expiresIn: string;
  email: string;
  localId: string;
  displayName?: string;
}

function getApiKey(): string {
  const apiKey =
    import.meta.env.VITE_FIREBASE_WEB_API_KEY ||
    import.meta.env.VITE_FIREBASE_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing VITE_FIREBASE_API_KEY (or legacy VITE_FIREBASE_WEB_API_KEY) in frontend/.env.",
    );
  }

  return apiKey;
}

function toAuthTokens(response: FirebaseAuthResponse): FirebaseAuthTokens {
  return {
    idToken: response.idToken,
    refreshToken: response.refreshToken,
    email: response.email,
    localId: response.localId,
    expiresAt: Date.now() + Number(response.expiresIn) * 1000,
  };
}

function mapFirebaseError(code?: string): string {
  switch (code) {
    case "EMAIL_EXISTS":
      return "This email is already registered.";
    case "EMAIL_NOT_FOUND":
    case "INVALID_PASSWORD":
    case "INVALID_LOGIN_CREDENTIALS":
      return "The email or password is incorrect.";
    case "WEAK_PASSWORD : Password should be at least 6 characters":
    case "WEAK_PASSWORD":
      return "Password must be at least 6 characters.";
    case "TOO_MANY_ATTEMPTS_TRY_LATER":
      return "Too many attempts. Please try again in a moment.";
    case "USER_DISABLED":
      return "This account has been disabled.";
    default:
      return "Firebase authentication is currently unavailable.";
  }
}

async function parseFirebaseResponse<T>(response: Response): Promise<T> {
  const json = (await response.json()) as T & {
    error?: {
      message?: string;
    };
  };

  if (!response.ok) {
    throw new Error(mapFirebaseError(json.error?.message));
  }

  return json;
}

async function authRequest(
  endpoint: string,
  payload: Record<string, unknown>,
): Promise<FirebaseAuthResponse> {
  const response = await fetch(`${FIREBASE_AUTH_BASE_URL}/${endpoint}?key=${getApiKey()}`, {
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  return parseFirebaseResponse<FirebaseAuthResponse>(response);
}

export async function signInWithEmailAndPassword(
  email: string,
  password: string,
): Promise<FirebaseAuthTokens> {
  const response = await authRequest("accounts:signInWithPassword", {
    email,
    password,
    returnSecureToken: true,
  });

  return toAuthTokens(response);
}

export async function signInWithCustomToken(
  customToken: string,
): Promise<FirebaseAuthTokens> {
  const response = await authRequest("accounts:signInWithCustomToken", {
    token: customToken,
    returnSecureToken: true,
  });

  return toAuthTokens(response);
}

export async function createUserWithEmailAndPassword(
  fullName: string,
  email: string,
  password: string,
): Promise<FirebaseAuthTokens> {
  const signUpResponse = await authRequest("accounts:signUp", {
    email,
    password,
    returnSecureToken: true,
  });

  const updatedProfileResponse = await authRequest("accounts:update", {
    displayName: fullName,
    idToken: signUpResponse.idToken,
    returnSecureToken: true,
  });

  return toAuthTokens(updatedProfileResponse);
}

export async function refreshFirebaseToken(refreshToken: string): Promise<FirebaseAuthTokens> {
  const response = await fetch(`${FIREBASE_REFRESH_URL}?key=${getApiKey()}`, {
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  const json = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: string;
    user_id?: string;
    error?: {
      message?: string;
    };
  };

  if (!response.ok || !json.access_token || !json.refresh_token || !json.expires_in || !json.user_id) {
    throw new Error(mapFirebaseError(json.error?.message));
  }

  return {
    idToken: json.access_token,
    refreshToken: json.refresh_token,
    email: "",
    localId: json.user_id,
    expiresAt: Date.now() + Number(json.expires_in) * 1000,
  };
}
