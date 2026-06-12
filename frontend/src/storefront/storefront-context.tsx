/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
  type PropsWithChildren,
} from "react";

import {
  createUserWithEmailAndPassword,
  refreshFirebaseToken,
  signInWithEmailAndPassword,
  type FirebaseAuthTokens,
} from "../services/firebase-auth";
import { useFeedback } from "../feedback/feedback-context";
import { setApiAuthToken, storefrontApi } from "../services/api";
import type {
  AuthUserProfile,
  CartRecord,
  CheckoutCartResponse,
  FavoriteRecord,
  FinalizeCheckoutPayload,
  SyncAuthSessionPayload,
  UpdateUserProfilePayload,
  UserRole,
} from "../shared";

type AuthMode = "sign-in" | "sign-up";
type ViewerRole = UserRole | "guest";

interface StorefrontState {
  authBusy: boolean;
  authError: string | null;
  authLoading: boolean;
  authModalOpen: boolean;
  authMode: AuthMode;
  cart: CartRecord | null;
  commerceLoading: boolean;
  favorites: FavoriteRecord | null;
  tokens: FirebaseAuthTokens | null;
  user: AuthUserProfile | null;
}

type StorefrontAction =
  | { type: "auth_modal/open"; mode: AuthMode }
  | { type: "auth_modal/close" }
  | { type: "auth/request" }
  | { type: "auth/error"; error: string }
  | { type: "auth/signed_out" }
  | { type: "session/hydrate_start" }
  | {
      type: "session/hydrate_success";
      cart: CartRecord;
      favorites: FavoriteRecord;
      tokens: FirebaseAuthTokens;
      user: AuthUserProfile;
    }
  | { type: "tokens/update"; tokens: FirebaseAuthTokens }
  | { type: "profile/update_success"; user: AuthUserProfile }
  | { type: "favorites/update"; favorites: FavoriteRecord }
  | { type: "cart/update"; cart: CartRecord };

interface AuthCredentials {
  email: string;
  password: string;
}

interface RegisterCredentials extends AuthCredentials {
  fullName: string;
}

interface StorefrontContextValue {
  authBusy: boolean;
  authError: string | null;
  authLoading: boolean;
  authModalOpen: boolean;
  authMode: AuthMode;
  cart: CartRecord | null;
  cartCount: number;
  checkoutCart: (payload: FinalizeCheckoutPayload) => Promise<CheckoutCartResponse>;
  closeAuthModal: () => void;
  commerceLoading: boolean;
  favorites: FavoriteRecord | null;
  favoriteCount: number;
  isAdmin: boolean;
  isAuthenticated: boolean;
  isGuest: boolean;
  openAuthModal: (mode?: AuthMode) => void;
  role: ViewerRole;
  refreshSession: () => Promise<void>;
  removeCartItem: (itemId: string) => Promise<void>;
  saveProfile: (payload: UpdateUserProfilePayload) => Promise<void>;
  signIn: (credentials: AuthCredentials) => Promise<void>;
  signOut: () => void;
  signUp: (credentials: RegisterCredentials) => Promise<void>;
  toggleFavorite: (productId: string) => Promise<void>;
  updateCartQuantity: (itemId: string, quantity: number) => Promise<void>;
  addToCart: (productVariantId: string, quantity?: number) => Promise<void>;
  user: AuthUserProfile | null;
}

const StorefrontContext = createContext<StorefrontContextValue | null>(null);

const TOKENS_STORAGE_KEY = "watchroom.firebase.tokens";
const USER_STORAGE_KEY = "watchroom.auth.user";
const FAVORITES_STORAGE_KEY = "watchroom.favorites";
const CART_STORAGE_KEY = "watchroom.cart";
const LEGACY_SHARED_SESSION_KEYS = [
  TOKENS_STORAGE_KEY,
  USER_STORAGE_KEY,
  FAVORITES_STORAGE_KEY,
  CART_STORAGE_KEY,
];

interface ScopedStorefrontCache<T> {
  ownerId: string;
  value: T;
}

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage;
}

function clearLegacySharedSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  for (const key of LEGACY_SHARED_SESSION_KEYS) {
    window.localStorage.removeItem(key);
  }
}

function readStoredTokens(): FirebaseAuthTokens | null {
  const storage = getSessionStorage();

  if (!storage) {
    return null;
  }

  const rawValue = storage.getItem(TOKENS_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as FirebaseAuthTokens;
  } catch {
    storage.removeItem(TOKENS_STORAGE_KEY);
    return null;
  }
}

function persistTokens(tokens: FirebaseAuthTokens | null): void {
  const storage = getSessionStorage();

  if (!storage) {
    return;
  }

  if (!tokens) {
    storage.removeItem(TOKENS_STORAGE_KEY);
    window.localStorage.removeItem(TOKENS_STORAGE_KEY);
    return;
  }

  storage.setItem(TOKENS_STORAGE_KEY, JSON.stringify(tokens));
  window.localStorage.removeItem(TOKENS_STORAGE_KEY);
}

function readStoredUser(): AuthUserProfile | null {
  const storage = getSessionStorage();

  if (!storage) {
    return null;
  }

  const rawValue = storage.getItem(USER_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as AuthUserProfile;
  } catch {
    storage.removeItem(USER_STORAGE_KEY);
    return null;
  }
}

function persistUser(user: AuthUserProfile | null): void {
  const storage = getSessionStorage();

  if (!storage) {
    return;
  }

  if (!user) {
    storage.removeItem(USER_STORAGE_KEY);
    window.localStorage.removeItem(USER_STORAGE_KEY);
    return;
  }

  storage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  window.localStorage.removeItem(USER_STORAGE_KEY);
}

function readScopedStorefrontCache<T>(
  storageKey: string,
  ownerId: string,
): T | null {
  const storage = getSessionStorage();

  if (!storage) {
    return null;
  }

  const rawValue = storage.getItem(storageKey);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as ScopedStorefrontCache<T>;

    if (parsed.ownerId !== ownerId) {
      return null;
    }

    return parsed.value;
  } catch {
    storage.removeItem(storageKey);
    return null;
  }
}

function persistScopedStorefrontCache<T>(
  storageKey: string,
  ownerId: string,
  value: T | null,
): void {
  const storage = getSessionStorage();

  if (!storage) {
    return;
  }

  if (!value) {
    storage.removeItem(storageKey);
    window.localStorage.removeItem(storageKey);
    return;
  }

  const payload: ScopedStorefrontCache<T> = {
    ownerId,
    value,
  };

  storage.setItem(storageKey, JSON.stringify(payload));
  window.localStorage.removeItem(storageKey);
}

function clearPersistedSession(): void {
  persistTokens(null);
  persistUser(null);
  persistScopedStorefrontCache(FAVORITES_STORAGE_KEY, "", null);
  persistScopedStorefrontCache(CART_STORAGE_KEY, "", null);
  clearLegacySharedSession();
  setApiAuthToken(null);
}

function createEmptyFavoriteRecord(userId: string): FavoriteRecord {
  return {
    id: userId,
    userId,
    items: [],
    updatedAt: new Date().toISOString(),
    count: 0,
  };
}

function createEmptyCartRecord(userId: string): CartRecord {
  return {
    id: userId,
    userId,
    sessionId: null,
    totalAmount: 0,
    updatedAt: new Date().toISOString(),
    items: [],
    itemCount: 0,
  };
}

function areTokensEqual(
  left: FirebaseAuthTokens | null,
  right: FirebaseAuthTokens | null,
): boolean {
  if (!left || !right) {
    return left === right;
  }

  return (
    left.idToken === right.idToken &&
    left.refreshToken === right.refreshToken &&
    left.email === right.email &&
    left.localId === right.localId &&
    left.expiresAt === right.expiresAt
  );
}

function initialState(): StorefrontState {
  clearLegacySharedSession();

  const tokens = readStoredTokens();
  const storedUser = readStoredUser();
  const storedFavorites = storedUser
    ? readScopedStorefrontCache<FavoriteRecord>(
        FAVORITES_STORAGE_KEY,
        storedUser.id,
      )
    : null;
  const storedCart = storedUser
    ? readScopedStorefrontCache<CartRecord>(CART_STORAGE_KEY, storedUser.id)
    : null;

  if (tokens?.idToken) {
    setApiAuthToken(tokens.idToken);
  }

  return {
    authBusy: false,
    authError: null,
    authLoading: Boolean(tokens) && !storedUser,
    authModalOpen: false,
    authMode: "sign-in",
    cart: tokens ? storedCart : null,
    commerceLoading: Boolean(tokens),
    favorites: tokens ? storedFavorites : null,
    tokens,
    user: tokens ? storedUser : null,
  };
}

function reducer(
  state: StorefrontState,
  action: StorefrontAction,
): StorefrontState {
  switch (action.type) {
    case "auth_modal/open":
      return {
        ...state,
        authError: null,
        authModalOpen: true,
        authMode: action.mode,
      };
    case "auth_modal/close":
      return {
        ...state,
        authError: null,
        authModalOpen: false,
      };
    case "auth/request":
      return {
        ...state,
        authBusy: true,
        authError: null,
      };
    case "auth/error":
      return {
        ...state,
        authBusy: false,
        authError: action.error,
        authLoading: false,
        commerceLoading: false,
      };
    case "session/hydrate_start":
      return {
        ...state,
        authBusy: false,
        authError: null,
        authLoading: !state.user,
        commerceLoading: !state.cart && !state.favorites,
      };
    case "session/hydrate_success":
      return {
        ...state,
        authBusy: false,
        authError: null,
        authLoading: false,
        authModalOpen: false,
        cart: action.cart,
        commerceLoading: false,
        favorites: action.favorites,
        tokens: areTokensEqual(state.tokens, action.tokens)
          ? state.tokens
          : action.tokens,
        user: action.user,
      };
    case "tokens/update":
      return {
        ...state,
        tokens: areTokensEqual(state.tokens, action.tokens)
          ? state.tokens
          : action.tokens,
      };
    case "profile/update_success":
      return {
        ...state,
        authBusy: false,
        authError: null,
        user: action.user,
      };
    case "favorites/update":
      return {
        ...state,
        authBusy: false,
        authError: null,
        favorites: action.favorites,
      };
    case "cart/update":
      return {
        ...state,
        authBusy: false,
        authError: null,
        cart: action.cart,
      };
    case "auth/signed_out":
      return {
        ...state,
        authBusy: false,
        authError: null,
        authLoading: false,
        authModalOpen: false,
        cart: null,
        commerceLoading: false,
        favorites: null,
        tokens: null,
        user: null,
      };
    default:
      return state;
  }
}

async function fetchSessionBundle(tokens: FirebaseAuthTokens): Promise<{
  cart: CartRecord;
  favorites: FavoriteRecord;
  user: AuthUserProfile;
}>;
async function fetchSessionBundle(
  tokens: FirebaseAuthTokens,
  fallback: {
    cart?: CartRecord | null;
    favorites?: FavoriteRecord | null;
  },
): Promise<{
  cart: CartRecord;
  favorites: FavoriteRecord;
  user: AuthUserProfile;
}>;
async function fetchSessionBundle(
  tokens: FirebaseAuthTokens,
  fallback: {
    cart?: CartRecord | null;
    favorites?: FavoriteRecord | null;
  } = {},
): Promise<{
  cart: CartRecord;
  favorites: FavoriteRecord;
  user: AuthUserProfile;
}> {
  setApiAuthToken(tokens.idToken);

  const session = await storefrontApi.getAuthSession();
  const [favoritesResult, cartResult] = await Promise.allSettled([
    storefrontApi.getFavorites(),
    storefrontApi.getCart(),
  ]);

  const favorites =
    favoritesResult.status === "fulfilled"
      ? favoritesResult.value
      : (fallback.favorites ?? createEmptyFavoriteRecord(session.user.id));
  const cart =
    cartResult.status === "fulfilled"
      ? cartResult.value
      : (fallback.cart ?? createEmptyCartRecord(session.user.id));

  return {
    cart,
    favorites,
    user: session.user,
  };
}

export function StorefrontProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const { notify } = useFeedback();
  const tokens = state.tokens;
  const lastHydratedTokenKeyRef = useRef<string | null>(null);
  const role: ViewerRole = state.user?.role ?? "guest";
  const isAuthenticated = Boolean(state.user);
  const isAdmin = role === "admin";
  const isGuest = role === "guest";

  useEffect(() => {
    if (!tokens) {
      lastHydratedTokenKeyRef.current = null;
      return;
    }

    const tokenKey = `${tokens.localId}:${tokens.idToken}:${tokens.refreshToken}`;

    if (lastHydratedTokenKeyRef.current === tokenKey) {
      return;
    }

    let active = true;

    dispatch({ type: "session/hydrate_start" });

    const hydrate = async () => {
      try {
        const bundle = await fetchSessionBundle(tokens, {
          cart: state.cart,
          favorites: state.favorites,
        });

        if (!active) {
          return;
        }

        lastHydratedTokenKeyRef.current = tokenKey;
        persistTokens({
          ...tokens,
          email: bundle.user.email,
        });
        persistUser(bundle.user);

        dispatch({
          type: "session/hydrate_success",
          cart: bundle.cart,
          favorites: bundle.favorites,
          tokens: {
            ...tokens,
            email: bundle.user.email,
          },
          user: bundle.user,
        });
      } catch {
        if (!active || !tokens.refreshToken) {
          clearPersistedSession();
          dispatch({ type: "auth/signed_out" });
          return;
        }

        try {
          const refreshedTokens = await refreshFirebaseToken(
            tokens.refreshToken,
          );
          const bundle = await fetchSessionBundle(refreshedTokens, {
            cart: state.cart,
            favorites: state.favorites,
          });

          if (!active) {
            return;
          }

          const normalizedTokens = {
            ...refreshedTokens,
            email: bundle.user.email,
          };
          const refreshedTokenKey = `${normalizedTokens.localId}:${normalizedTokens.idToken}:${normalizedTokens.refreshToken}`;

          lastHydratedTokenKeyRef.current = refreshedTokenKey;
          persistTokens(normalizedTokens);
          persistUser(bundle.user);
          dispatch({
            type: "session/hydrate_success",
            cart: bundle.cart,
            favorites: bundle.favorites,
            tokens: normalizedTokens,
            user: bundle.user,
          });
        } catch {
          if (!active) {
            return;
          }

          lastHydratedTokenKeyRef.current = null;
          clearPersistedSession();
          dispatch({ type: "auth/signed_out" });
        }
      }
    };

    void hydrate();

    return () => {
      active = false;
    };
  }, [state.cart, state.favorites, tokens]);

  useEffect(() => {
    if (!state.user) {
      persistScopedStorefrontCache(FAVORITES_STORAGE_KEY, "", null);
      persistScopedStorefrontCache(CART_STORAGE_KEY, "", null);
      return;
    }

    persistScopedStorefrontCache(
      FAVORITES_STORAGE_KEY,
      state.user.id,
      state.favorites,
    );
    persistScopedStorefrontCache(CART_STORAGE_KEY, state.user.id, state.cart);
  }, [state.cart, state.favorites, state.user]);

  const ensureAuthenticated = async (): Promise<FirebaseAuthTokens> => {
    if (!state.tokens) {
      dispatch({ type: "auth_modal/open", mode: "sign-in" });
      throw new Error("Please sign in to continue.");
    }

    if (state.tokens.expiresAt <= Date.now() + 60_000) {
      const refreshedTokens = await refreshFirebaseToken(
        state.tokens.refreshToken,
      );
      const normalizedTokens = {
        ...refreshedTokens,
        email: state.tokens.email || refreshedTokens.email,
      };

      persistTokens(normalizedTokens);
      setApiAuthToken(normalizedTokens.idToken);
      dispatch({ type: "tokens/update", tokens: normalizedTokens });

      return normalizedTokens;
    }

    return state.tokens;
  };

  const completeAuthFlow = async (
    tokens: FirebaseAuthTokens,
    payload: SyncAuthSessionPayload = {},
  ) => {
    persistTokens(tokens);
    setApiAuthToken(tokens.idToken);

    const session = await storefrontApi.syncAuthSession(payload);
    const [favoritesResult, cartResult] = await Promise.allSettled([
      storefrontApi.getFavorites(),
      storefrontApi.getCart(),
    ]);
    const favorites =
      favoritesResult.status === "fulfilled"
        ? favoritesResult.value
        : createEmptyFavoriteRecord(session.user.id);
    const cart =
      cartResult.status === "fulfilled"
        ? cartResult.value
        : createEmptyCartRecord(session.user.id);

    const normalizedTokens = {
      ...tokens,
      email: session.user.email,
    };
    const tokenKey = `${normalizedTokens.localId}:${normalizedTokens.idToken}:${normalizedTokens.refreshToken}`;

    lastHydratedTokenKeyRef.current = tokenKey;
    persistTokens(normalizedTokens);
    persistUser(session.user);

    dispatch({
      type: "session/hydrate_success",
      cart,
      favorites,
      tokens: normalizedTokens,
      user: session.user,
    });
  };

  const openAuthModal = (mode: AuthMode = "sign-in") => {
    dispatch({ type: "auth_modal/open", mode });
  };

  const closeAuthModal = () => {
    dispatch({ type: "auth_modal/close" });
  };

  const signIn = async ({ email, password }: AuthCredentials) => {
    dispatch({ type: "auth/request" });

    try {
      const tokens = await signInWithEmailAndPassword(email.trim(), password);
      await completeAuthFlow(tokens);
      notify({
        description: "Favorites, cart, and account surfaces are now synced.",
        title: "Signed in successfully",
        tone: "success",
      });
    } catch (error) {
      notify({
        description:
          error instanceof Error
            ? error.message
            : "Unable to sign in right now.",
        title: "Sign-in failed",
        tone: "error",
      });
      dispatch({
        type: "auth/error",
        error:
          error instanceof Error
            ? error.message
            : "Unable to sign in right now.",
      });
      throw error;
    }
  };

  const signUp = async ({ fullName, email, password }: RegisterCredentials) => {
    dispatch({ type: "auth/request" });

    try {
      const tokens = await createUserWithEmailAndPassword(
        fullName.trim(),
        email.trim(),
        password,
      );
      await completeAuthFlow(tokens, { fullName: fullName.trim() });
      notify({
        description: "Your account is ready.",
        title: "Account created",
        tone: "success",
      });
    } catch (error) {
      notify({
        description:
          error instanceof Error
            ? error.message
            : "Unable to create your account right now.",
        title: "Sign-up failed",
        tone: "error",
      });
      dispatch({
        type: "auth/error",
        error:
          error instanceof Error
            ? error.message
            : "Unable to create your account right now.",
      });
      throw error;
    }
  };

  const signOut = () => {
    clearPersistedSession();
    dispatch({ type: "auth/signed_out" });
    notify({
      description: "Your account session has been closed.",
      title: "Signed out",
      tone: "info",
    });
  };

  const refreshSession = async () => {
    const activeTokens = await ensureAuthenticated();

    dispatch({ type: "session/hydrate_start" });

    try {
      const bundle = await fetchSessionBundle(activeTokens, {
        cart: state.cart,
        favorites: state.favorites,
      });
      dispatch({
        type: "session/hydrate_success",
        cart: bundle.cart,
        favorites: bundle.favorites,
        tokens: {
          ...activeTokens,
          email: bundle.user.email,
        },
        user: bundle.user,
      });
    } catch (error) {
      dispatch({
        type: "auth/error",
        error:
          error instanceof Error
            ? error.message
            : "Unable to refresh your session right now.",
      });
      throw error;
    }
  };

  const saveProfile = async (payload: UpdateUserProfilePayload) => {
    await ensureAuthenticated();
    dispatch({ type: "auth/request" });

    try {
      const session = await storefrontApi.updateProfile(payload);
      persistUser(session.user);
      dispatch({ type: "profile/update_success", user: session.user });
      notify({
        description: "Your account details have been updated.",
        title: "Profile saved",
        tone: "success",
      });
    } catch (error) {
      notify({
        description:
          error instanceof Error
            ? error.message
            : "Unable to save your profile right now.",
        title: "Profile update failed",
        tone: "error",
      });
      dispatch({
        type: "auth/error",
        error:
          error instanceof Error
            ? error.message
            : "Unable to save your profile right now.",
      });
      throw error;
    }
  };

  const toggleFavorite = async (productId: string) => {
    await ensureAuthenticated();
    dispatch({ type: "auth/request" });

    try {
      const isFavorite = state.favorites?.items.some(
        (item) => item.productId === productId,
      );
      const favorites = isFavorite
        ? await storefrontApi.removeFavorite(productId)
        : await storefrontApi.addFavorite(productId);

      dispatch({ type: "favorites/update", favorites });
    } catch (error) {
      dispatch({
        type: "auth/error",
        error:
          error instanceof Error
            ? error.message
            : "Unable to update favorites right now.",
      });
      throw error;
    }
  };

  const addToCart = async (productVariantId: string, quantity = 1) => {
    await ensureAuthenticated();
    dispatch({ type: "auth/request" });

    try {
      const cart = await storefrontApi.addCartItem({
        productVariantId,
        quantity,
      });
      dispatch({ type: "cart/update", cart });
    } catch (error) {
      dispatch({
        type: "auth/error",
        error:
          error instanceof Error
            ? error.message
            : "Unable to update your cart right now.",
      });
      throw error;
    }
  };

  const updateCartQuantity = async (itemId: string, quantity: number) => {
    await ensureAuthenticated();
    dispatch({ type: "auth/request" });

    try {
      const cart = await storefrontApi.updateCartItem(itemId, { quantity });
      dispatch({ type: "cart/update", cart });
    } catch (error) {
      dispatch({
        type: "auth/error",
        error:
          error instanceof Error
            ? error.message
            : "Unable to update your cart right now.",
      });
      throw error;
    }
  };

  const removeCartItem = async (itemId: string) => {
    await ensureAuthenticated();
    dispatch({ type: "auth/request" });

    try {
      const cart = await storefrontApi.removeCartItem(itemId);
      dispatch({ type: "cart/update", cart });
    } catch (error) {
      dispatch({
        type: "auth/error",
        error:
          error instanceof Error
            ? error.message
            : "Unable to update your cart right now.",
      });
      throw error;
    }
  };

  const checkoutCart = async (
    payload: FinalizeCheckoutPayload,
  ): Promise<CheckoutCartResponse> => {
    await ensureAuthenticated();
    dispatch({ type: "auth/request" });

    try {
      const normalizedShippingAddress = payload.details.shippingAddress.trim();
      const result = await storefrontApi.finalizeCheckout({
        ...payload,
        details: {
          ...payload.details,
          deliveryNotes: payload.details.deliveryNotes?.trim() ?? "",
          shippingAddress: normalizedShippingAddress,
        },
      });

      dispatch({ type: "cart/update", cart: result.cart });

      if (state.user && payload.details.saveToAccount) {
        try {
          const session = await storefrontApi.updateProfile({
            address: normalizedShippingAddress,
            fullName: payload.details.fullName.trim(),
            phoneNumber: payload.details.phoneNumber.trim(),
          });
          persistUser(session.user);
          dispatch({ type: "profile/update_success", user: session.user });
        } catch {
          // Keep checkout successful even if profile sync is temporarily unavailable.
        }
      }

      return result;
    } catch (error) {
      dispatch({
        type: "auth/error",
        error:
          error instanceof Error
            ? error.message
            : "Unable to create your reserve right now.",
      });
      throw error;
    }
  };

  return (
    <StorefrontContext.Provider
      value={{
        addToCart,
        authBusy: state.authBusy,
        authError: state.authError,
        authLoading: state.authLoading,
        authModalOpen: state.authModalOpen,
        authMode: state.authMode,
        cart: state.cart,
        cartCount: state.cart?.itemCount ?? 0,
        checkoutCart,
        closeAuthModal,
        commerceLoading: state.commerceLoading,
        favoriteCount: state.favorites?.count ?? 0,
        favorites: state.favorites,
        isAdmin,
        isAuthenticated,
        isGuest,
        openAuthModal,
        role,
        refreshSession,
        removeCartItem,
        saveProfile,
        signIn,
        signOut,
        signUp,
        toggleFavorite,
        updateCartQuantity,
        user: state.user,
      }}
    >
      {children}
    </StorefrontContext.Provider>
  );
}

export function useStorefront(): StorefrontContextValue {
  const context = useContext(StorefrontContext);

  if (!context) {
    throw new Error("useStorefront must be used within StorefrontProvider.");
  }

  return context;
}
