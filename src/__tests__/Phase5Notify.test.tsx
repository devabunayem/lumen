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
    expect(screen.getByText("Payment Alert")).toBeInTheDocument();
    expect(screen.getByText("Code •••• received")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Payment Alert"));
    expect(onDismiss).toHaveBeenCalled();
  });
});
