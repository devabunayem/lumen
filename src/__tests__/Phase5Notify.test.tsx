import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NotificationToast } from "../app/NotificationToast";

describe("NotificationToast (FR-NT-1..2)", () => {
  it("renders sanitized notification and dismisses on click", () => {
    const onDismiss = vi.fn();
    render(
      <NotificationToast
        notification={{
          id: 1,
          app_name: "WhatsApp",
          title: "Payment Alert",
          body: "Code •••• received",
        }}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByTestId("notification-app-icon")).toBeInTheDocument();
    expect(screen.getByText("Payment Alert")).toBeInTheDocument();
    expect(screen.getByText("Code •••• received")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Payment Alert"));
    expect(onDismiss).toHaveBeenCalled();
  });

  it("renders real extracted desktop/browser app logo when provided", () => {
    render(
      <NotificationToast
        notification={{
          id: 2,
          app_name: "Google Chrome",
          title: "New email on Gmail",
          body: "Meeting link updated",
          app_icon_data_url: "data:image/png;base64,iVBORw0KGgo=",
          source_app_id: "Chrome",
        }}
        onDismiss={vi.fn()}
      />,
    );
    const img = screen.getByRole("img", { name: "Google Chrome" });
    expect(img).toHaveAttribute("src", "data:image/png;base64,iVBORw0KGgo=");
    expect(screen.getByText("Google Chrome")).toBeInTheDocument();
  });
});
