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

  it("displays full multi-line message previews without CSS truncation", () => {
    const fullMessage =
      "Hey team, please review the updated release candidate build before 8:00 PM tonight and drop your sign-off in the thread!";
    render(
      <NotificationToast
        notification={{
          id: 3,
          app_name: "WhatsApp",
          title: "Abu Nayem",
          body: fullMessage,
        }}
        onDismiss={vi.fn()}
      />,
    );
    const bodyEl = screen.getByTestId("notification-body");
    expect(bodyEl).toHaveTextContent(fullMessage);
    expect(bodyEl.className).not.toContain("truncate");
  });

  it("caps extra-long messages with a More button that toggles full scrollable preview", () => {
    const longMsg = "Very important long message preview ".repeat(16).trim();
    const onToggleExpand = vi.fn();
    const { rerender } = render(
      <NotificationToast
        notification={{
          id: 4,
          app_name: "Messenger",
          title: "Client Thread",
          body: longMsg,
        }}
        expanded={false}
        onToggleExpand={onToggleExpand}
        onDismiss={vi.fn()}
      />,
    );
    const bodyEl = screen.getByTestId("notification-body");
    expect(bodyEl.className).toContain("line-clamp-3");
    const moreBtn = screen.getByTestId("notification-more-btn");
    expect(moreBtn).toHaveTextContent("More");
    fireEvent.click(moreBtn);
    expect(onToggleExpand).toHaveBeenCalledWith(true);

    rerender(
      <NotificationToast
        notification={{
          id: 4,
          app_name: "Messenger",
          title: "Client Thread",
          body: longMsg,
        }}
        expanded
        onToggleExpand={onToggleExpand}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByTestId("notification-body").className).not.toContain("line-clamp-3");
    expect(screen.getByTestId("notification-more-btn")).toHaveTextContent("Show less");
    expect(screen.getByTestId("notification-close-btn")).toBeInTheDocument();
  });
});
