import axios from "axios";

import type {
  AddCartItemPayload,
  AdminAiOperationsRequest,
  AdminAiOperationsResponse,
  AiConciergeRequest,
  AiConciergeResponse,
  ApiResponse,
  AuthSession,
  CartRecord,
  CheckoutCartPayload,
  CheckoutCartResponse,
  FinalizeCheckoutPayload,
  FirebaseCustomTokenResponse,
  EmailOtpResponse,
  PrepareCheckoutPaymentPayload,
  PrepareCheckoutPaymentResponse,
  CreateProductPayload,
  CreateOrderPayload,
  FavoriteRecord,
  OrderRecord,
  ProductReviewsResponse,
  ProductDiscoveryQuery,
  ProductDiscoveryResponse,
  ProductRecord,
  PublicReviewRecord,
  ReviewAdminQuery,
  ReviewRecord,
  RequestEmailOtpPayload,
  SyncAuthSessionPayload,
  UpsertReviewPayload,
  UpdateCartItemPayload,
  UpdateOrderPayload,
  UpdateProductPayload,
  UpdateUserProfilePayload,
  VerifyEmailOtpPayload,
} from "../shared";

const LOCAL_API_BASE_URL = "http://localhost:4000/api";

function getApiBaseUrl(): string {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  if (typeof window !== "undefined") {
    const isLocalHost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "::1";

    if (isLocalHost) {
      return LOCAL_API_BASE_URL;
    }
  }

  return "/api";
}

const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 10000,
});

function resolveApiRequestUrl(path: string, baseUrl = api.defaults.baseURL ?? ""): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  if (!baseUrl) {
    return path;
  }

  if (/^https?:\/\//i.test(baseUrl)) {
    return new URL(path, `${baseUrl.replace(/\/$/, "")}/`).toString();
  }

  return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

function toApiRequestError(error: unknown, path: string): Error {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error
      ? error
      : new Error("Unable to connect to the API.");
  }

  const responseData = error.response?.data as
    | { details?: unknown; error?: unknown }
    | undefined;

  if (typeof responseData?.error === "string") {
    const details = Array.isArray(responseData.details)
      ? responseData.details.filter(
          (detail): detail is string => typeof detail === "string",
        )
      : [];
    const detailSuffix = details.length > 0 ? ` ${details.join(" ")}` : "";

    return new Error(`${responseData.error}${detailSuffix}`);
  }

  const method = error.config?.method?.toUpperCase() ?? "REQUEST";
  const status = error.response?.status;
  const url = resolveApiRequestUrl(error.config?.url ?? path, error.config?.baseURL);
  const statusLabel = status ? `status ${status}` : "network error";

  return new Error(`${method} ${url} failed with ${statusLabel}.`);
}

async function unwrapResponse<T>(request: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const response = await request.catch((error: unknown) => {
    throw toApiRequestError(error, "");
  });

  if (!response.data.success) {
    throw new Error(response.data.error);
  }

  return response.data.data;
}

export function setApiAuthToken(token: string | null): void {
  if (!token) {
    delete api.defaults.headers.common.Authorization;
    return;
  }

  api.defaults.headers.common.Authorization = `Bearer ${token}`;
}

export const storefrontApi = {
  async getHealth(): Promise<{ status: string; environment: string }> {
    return unwrapResponse(api.get<ApiResponse<{ status: string; environment: string }>>("/health"));
  },
  async getProducts(search?: string): Promise<ProductRecord[]> {
    return unwrapResponse(
      api.get<ApiResponse<ProductRecord[]>>("/products", {
        params: search ? { search } : undefined,
      }),
    );
  },
  async getProductDiscovery(query: ProductDiscoveryQuery): Promise<ProductDiscoveryResponse> {
    return unwrapResponse(
      api.get<ApiResponse<ProductDiscoveryResponse>>("/products/discovery", {
        params: query,
      }),
    );
  },
  async getProduct(productId: string): Promise<ProductRecord> {
    return unwrapResponse(api.get<ApiResponse<ProductRecord>>(`/products/${productId}`));
  },
  async getProductReviews(productId: string): Promise<ProductReviewsResponse> {
    return unwrapResponse(
      api.get<ApiResponse<ProductReviewsResponse>>(`/products/${productId}/reviews`),
    );
  },
  async getMyProductReview(productId: string): Promise<PublicReviewRecord | null> {
    return unwrapResponse(
      api.get<ApiResponse<PublicReviewRecord | null>>(`/products/${productId}/reviews/me`),
    );
  },
  async upsertMyProductReview(
    productId: string,
    payload: UpsertReviewPayload,
  ): Promise<PublicReviewRecord> {
    return unwrapResponse(
      api.put<ApiResponse<PublicReviewRecord>>(`/products/${productId}/reviews/me`, payload),
    );
  },
  async deleteMyProductReview(productId: string): Promise<{ productId: string }> {
    return unwrapResponse(
      api.delete<ApiResponse<{ productId: string }>>(`/products/${productId}/reviews/me`),
    );
  },
  async createProduct(payload: CreateProductPayload): Promise<ProductRecord> {
    return unwrapResponse(api.post<ApiResponse<ProductRecord>>("/products", payload));
  },
  async uploadProductImage(payload: {
    dataUrl: string;
    fileName: string;
    mimeType: string;
  }): Promise<{ path: string; url: string }> {
    return unwrapResponse(
      api.post<ApiResponse<{ path: string; url: string }>>("/products/uploads", payload),
    );
  },
  async updateProduct(productId: string, payload: UpdateProductPayload): Promise<ProductRecord> {
    return unwrapResponse(api.put<ApiResponse<ProductRecord>>(`/products/${productId}`, payload));
  },
  async deleteProduct(productId: string): Promise<{ id: string }> {
    return unwrapResponse(api.delete<ApiResponse<{ id: string }>>(`/products/${productId}`));
  },
  async getAdminReviews(query: ReviewAdminQuery = {}): Promise<ReviewRecord[]> {
    return unwrapResponse(
      api.get<ApiResponse<ReviewRecord[]>>("/reviews", {
        params: query,
      }),
    );
  },
  async deleteReview(reviewId: string): Promise<{ id: string }> {
    return unwrapResponse(api.delete<ApiResponse<{ id: string }>>(`/reviews/${reviewId}`));
  },
  async getOrders(): Promise<OrderRecord[]> {
    return unwrapResponse(api.get<ApiResponse<OrderRecord[]>>("/orders"));
  },
  async createOrder(payload: CreateOrderPayload): Promise<OrderRecord> {
    return unwrapResponse(api.post<ApiResponse<OrderRecord>>("/orders", payload));
  },
  async updateOrder(orderId: string, payload: UpdateOrderPayload): Promise<OrderRecord> {
    return unwrapResponse(api.patch<ApiResponse<OrderRecord>>(`/orders/${orderId}`, payload));
  },
  async askAiConcierge(payload: AiConciergeRequest): Promise<AiConciergeResponse> {
    return unwrapResponse(
      api.post<ApiResponse<AiConciergeResponse>>("/support/ai-concierge", payload),
    );
  },
  async askAdminAiOperations(
    payload: AdminAiOperationsRequest,
  ): Promise<AdminAiOperationsResponse> {
    return unwrapResponse(
      api.post<ApiResponse<AdminAiOperationsResponse>>("/support/admin-ai", payload),
    );
  },
  async requestSignUpEmailOtp(payload: RequestEmailOtpPayload): Promise<EmailOtpResponse> {
    return unwrapResponse(
      api.post<ApiResponse<EmailOtpResponse>>("/auth/email-otp/sign-up/request", payload),
    );
  },
  async verifySignUpEmailOtp(payload: VerifyEmailOtpPayload): Promise<EmailOtpResponse> {
    return unwrapResponse(
      api.post<ApiResponse<EmailOtpResponse>>("/auth/email-otp/sign-up/verify", payload),
    );
  },
  async requestProfileEmailOtp(payload: RequestEmailOtpPayload): Promise<EmailOtpResponse> {
    return unwrapResponse(
      api.post<ApiResponse<EmailOtpResponse>>("/auth/email-otp/profile/request", payload),
    );
  },
  async syncAuthSession(payload: SyncAuthSessionPayload = {}): Promise<AuthSession> {
    return unwrapResponse(api.post<ApiResponse<AuthSession>>("/auth/session", payload));
  },
  async getAuthSession(): Promise<AuthSession> {
    return unwrapResponse(api.get<ApiResponse<AuthSession>>("/auth/me"));
  },
  async getFirebaseCustomToken(): Promise<FirebaseCustomTokenResponse> {
    const path = "/auth/firebase-token";

    try {
      return await unwrapResponse(api.post<ApiResponse<FirebaseCustomTokenResponse>>(path));
    } catch (error) {
      throw toApiRequestError(error, path);
    }
  },
  async updateProfile(payload: UpdateUserProfilePayload): Promise<AuthSession> {
    return unwrapResponse(api.patch<ApiResponse<AuthSession>>("/auth/me", payload));
  },
  async getFavorites(): Promise<FavoriteRecord> {
    return unwrapResponse(api.get<ApiResponse<FavoriteRecord>>("/favorites"));
  },
  async addFavorite(productId: string): Promise<FavoriteRecord> {
    return unwrapResponse(api.post<ApiResponse<FavoriteRecord>>(`/favorites/${productId}`));
  },
  async removeFavorite(productId: string): Promise<FavoriteRecord> {
    return unwrapResponse(api.delete<ApiResponse<FavoriteRecord>>(`/favorites/${productId}`));
  },
  async clearFavorites(): Promise<FavoriteRecord> {
    return unwrapResponse(api.delete<ApiResponse<FavoriteRecord>>("/favorites"));
  },
  async getCart(): Promise<CartRecord> {
    return unwrapResponse(api.get<ApiResponse<CartRecord>>("/cart"));
  },
  async addCartItem(payload: AddCartItemPayload): Promise<CartRecord> {
    return unwrapResponse(api.post<ApiResponse<CartRecord>>("/cart/items", payload));
  },
  async updateCartItem(itemId: string, payload: UpdateCartItemPayload): Promise<CartRecord> {
    return unwrapResponse(api.patch<ApiResponse<CartRecord>>(`/cart/items/${itemId}`, payload));
  },
  async removeCartItem(itemId: string): Promise<CartRecord> {
    return unwrapResponse(api.delete<ApiResponse<CartRecord>>(`/cart/items/${itemId}`));
  },
  async clearCart(): Promise<CartRecord> {
    return unwrapResponse(api.delete<ApiResponse<CartRecord>>("/cart"));
  },
  async checkoutCart(payload: CheckoutCartPayload): Promise<CheckoutCartResponse> {
    return unwrapResponse(api.post<ApiResponse<CheckoutCartResponse>>("/cart/checkout", payload));
  },
  async prepareCheckoutPayment(
    payload: PrepareCheckoutPaymentPayload,
  ): Promise<PrepareCheckoutPaymentResponse> {
    return unwrapResponse(
      api.post<ApiResponse<PrepareCheckoutPaymentResponse>>(
        "/cart/checkout/prepare",
        payload,
      ),
    );
  },
  async finalizeCheckout(
    payload: FinalizeCheckoutPayload,
  ): Promise<CheckoutCartResponse> {
    return unwrapResponse(
      api.post<ApiResponse<CheckoutCartResponse>>("/cart/checkout/finalize", payload),
    );
  },
};
