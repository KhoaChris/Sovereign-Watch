import nodemailer, { type Transporter } from "nodemailer";

import { env } from "../config/env";
import type { OrderRecord } from "../shared";

let transporter: Transporter | null = null;

interface OrderConfirmationEmailInput {
  customerEmail: string;
  customerName: string;
  order: OrderRecord;
}

interface EmailOtpInput {
  code: string;
  email: string;
  purpose: "profile_email_update" | "sign_up";
}

function getPrimaryAdminEmail(): string {
  return env.ADMIN_EMAILS.split(",")
    .map((value) => value.trim())
    .filter(Boolean)[0] ?? "";
}

function getFromAddress(): string {
  return env.SMTP_FROM_EMAIL.trim() || getPrimaryAdminEmail() || env.SMTP_USER.trim();
}

function isEmailConfigured(): boolean {
  return Boolean(
    env.SMTP_HOST.trim() &&
      env.SMTP_USER.trim() &&
      env.SMTP_PASS.trim() &&
      getFromAddress(),
  );
}

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      auth: {
        pass: env.SMTP_PASS,
        user: env.SMTP_USER,
      },
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
    });
  }

  return transporter;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function formatOrderDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function buildOrderTrackingUrl(orderId: string): string {
  const baseUrl = env.FRONTEND_URL.replace(/\/+$/, "");
  return `${baseUrl}/orders?orderId=${encodeURIComponent(orderId)}`;
}

function buildOrderEmailHtml(input: OrderConfirmationEmailInput): string {
  const trackingUrl = buildOrderTrackingUrl(input.order.id);
  const safeCustomerName = escapeHtml(input.customerName.trim() || "Client");
  const safeOrderNumber = escapeHtml(input.order.orderNumber);
  const safeTrackingUrl = escapeHtml(trackingUrl);
  const itemCount = input.order.items.reduce((sum, item) => sum + item.quantity, 0);

  return `
    <div style="margin:0;background:#090b11;color:#f7efe8;font-family:Georgia,'Times New Roman',serif;padding:40px 20px;">
      <div style="max-width:640px;margin:0 auto;border:1px solid rgba(217,181,139,.28);border-radius:28px;background:linear-gradient(145deg,#141821,#090b11);padding:36px;">
        <p style="margin:0 0 18px;color:#d9b58b;font:12px Arial,sans-serif;letter-spacing:6px;text-transform:uppercase;">Sovereign Reserve</p>
        <h1 style="margin:0 0 16px;font-size:38px;line-height:1.05;font-weight:400;">Your reserve is confirmed.</h1>
        <p style="margin:0 0 28px;color:#b5b8c8;font:16px/1.7 Arial,sans-serif;">
          Hello ${safeCustomerName}, your order has been placed successfully. You can follow payment, fulfillment, and delivery updates from your private orders desk.
        </p>

        <div style="border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:22px;margin:0 0 26px;background:rgba(255,255,255,.035);">
          <p style="margin:0 0 8px;color:#888b98;font:11px Arial,sans-serif;letter-spacing:4px;text-transform:uppercase;">Order number</p>
          <p style="margin:0 0 18px;font-size:28px;">${safeOrderNumber}</p>
          <p style="margin:0;color:#b5b8c8;font:14px/1.7 Arial,sans-serif;">
            ${itemCount} piece${itemCount === 1 ? "" : "s"} · ${formatCurrency(input.order.totalAmount)} · ${formatOrderDate(input.order.createdAt)}
          </p>
        </div>

        <a href="${safeTrackingUrl}" style="display:inline-block;border-radius:999px;background:#3d332a;border:1px solid rgba(217,181,139,.5);color:#fff;text-decoration:none;padding:15px 24px;font:12px Arial,sans-serif;letter-spacing:4px;text-transform:uppercase;">
          Track your order
        </a>

        <p style="margin:28px 0 0;color:#8f93a3;font:13px/1.7 Arial,sans-serif;">
          If the link asks you to sign in, use the same account email from checkout: ${escapeHtml(input.customerEmail)}.
        </p>
      </div>
    </div>
  `;
}

function buildOrderEmailText(input: OrderConfirmationEmailInput): string {
  const itemCount = input.order.items.reduce((sum, item) => sum + item.quantity, 0);

  return [
    `Hello ${input.customerName.trim() || "Client"},`,
    "",
    "Your Sovereign reserve has been placed successfully.",
    `Order: ${input.order.orderNumber}`,
    `Total: ${formatCurrency(input.order.totalAmount)}`,
    `Pieces: ${itemCount}`,
    `Created: ${formatOrderDate(input.order.createdAt)}`,
    "",
    `Track your order: ${buildOrderTrackingUrl(input.order.id)}`,
    "",
    "Sign in with the same account email used at checkout to view the private order desk.",
  ].join("\n");
}

function buildEmailOtpHtml(input: EmailOtpInput): string {
  const safeCode = escapeHtml(input.code);
  const headline =
    input.purpose === "sign_up"
      ? "Verify your email to create your private desk."
      : "Verify this email before updating your profile.";
  const supportCopy =
    input.purpose === "sign_up"
      ? "Use this code to finish creating your Sovereign account."
      : "Use this code to confirm the new email address for your Sovereign profile.";

  return `
    <div style="margin:0;background:#090b11;color:#f7efe8;font-family:Georgia,'Times New Roman',serif;padding:40px 20px;">
      <div style="max-width:600px;margin:0 auto;border:1px solid rgba(217,181,139,.28);border-radius:28px;background:linear-gradient(145deg,#141821,#090b11);padding:36px;">
        <p style="margin:0 0 18px;color:#d9b58b;font:12px Arial,sans-serif;letter-spacing:6px;text-transform:uppercase;">Sovereign Verification</p>
        <h1 style="margin:0 0 16px;font-size:34px;line-height:1.05;font-weight:400;">${headline}</h1>
        <p style="margin:0 0 28px;color:#b5b8c8;font:16px/1.7 Arial,sans-serif;">${supportCopy}</p>
        <div style="border:1px solid rgba(255,255,255,.12);border-radius:22px;padding:26px;text-align:center;background:rgba(255,255,255,.04);">
          <p style="margin:0 0 12px;color:#888b98;font:11px Arial,sans-serif;letter-spacing:4px;text-transform:uppercase;">Verification code</p>
          <p style="margin:0;color:#fff;font:38px Arial,sans-serif;letter-spacing:10px;font-weight:700;">${safeCode}</p>
        </div>
        <p style="margin:26px 0 0;color:#8f93a3;font:13px/1.7 Arial,sans-serif;">
          This code expires in 10 minutes. If you did not request it, you can ignore this email.
        </p>
      </div>
    </div>
  `;
}

function buildEmailOtpText(input: EmailOtpInput): string {
  const action =
    input.purpose === "sign_up"
      ? "create your Sovereign account"
      : "update your Sovereign profile email";

  return [
    `Your Sovereign verification code is ${input.code}.`,
    "",
    `Use this code to ${action}.`,
    "This code expires in 10 minutes.",
    "",
    "If you did not request it, you can ignore this email.",
  ].join("\n");
}

export async function sendOrderConfirmationEmail(
  input: OrderConfirmationEmailInput,
): Promise<void> {
  if (!isEmailConfigured()) {
    console.warn(
      "Order confirmation email skipped because SMTP settings are incomplete.",
    );
    return;
  }

  const fromEmail = getFromAddress();
  const fromName = env.SMTP_FROM_NAME.trim() || "Sovereign";

  await getTransporter().sendMail({
    from: `"${fromName.replace(/"/g, "'")}" <${fromEmail}>`,
    html: buildOrderEmailHtml(input),
    subject: `Your Sovereign order ${input.order.orderNumber} is confirmed`,
    text: buildOrderEmailText(input),
    to: input.customerEmail.trim(),
  });
}

export async function sendEmailOtp(input: EmailOtpInput): Promise<void> {
  if (!isEmailConfigured()) {
    throw new Error(
      "Email verification is unavailable because SMTP settings are incomplete.",
    );
  }

  const fromEmail = getFromAddress();
  const fromName = env.SMTP_FROM_NAME.trim() || "Sovereign";
  const subject =
    input.purpose === "sign_up"
      ? "Your Sovereign account verification code"
      : "Your Sovereign email change verification code";

  await getTransporter().sendMail({
    from: `"${fromName.replace(/"/g, "'")}" <${fromEmail}>`,
    html: buildEmailOtpHtml(input),
    subject,
    text: buildEmailOtpText(input),
    to: input.email.trim(),
  });
}
