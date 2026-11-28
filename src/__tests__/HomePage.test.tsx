import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DevStatesPage } from "../dev/DevStatesPage";
import { IslandShell } from "../app/IslandShell";
import { INITIAL_ISLAND_CONTEXT, useIslandStore } from "../app/stateMachine";

describe("Home Page & /dev/states 20 UI states", () => {
  it("renders all 20 required UI states cleanly including Bangla locale and 150% scale", () => {
    render(<DevStatesPage />);
    expect(screen.getByTestId("dev-states-page")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Home (20 States)" }));

    const expectedIds = [
      "default",
      "hover",
      "pressed",
      "focus-visible",
      "first-open-of-day",
      "night-arc",
      "friday-jumuah",
      "ramadan",
      "no-music",
      "no-calendar-tasks",
      "location-not-set",
      "loading-skeleton",
      "offline-weather",
      "error",
      "privacy-masked",
      "focus-session",
      "reduce-motion",
      "reduce-transparency",
      "scale-150",
      "bangla-locale",
    ];
    for (const id of expectedIds) {
      expect(screen.getByTestId(`dev-state-${id}`)).toBeInTheDocument();
    }
    expect(screen.getByText("960×468 px")).toBeInTheDocument();
  });

  it("filters to individual states cleanly without losing interactivity", async () => {
    render(<DevStatesPage />);
    fireEvent.click(screen.getByRole("button", { name: "Home (20 States)" }));
    const zoomBtn = screen.getByRole("button", { name: "no-music" });
    fireEvent.click(zoomBtn);
    const emptyState = await screen.findByTestId("music-empty-state");
    expect(emptyState).toBeInTheDocument();
    expect(
      within(emptyState).getByRole("button", { name: /Open Spotify|Resume/i }),
    ).toBeInTheDocument();
  });

  it("supports Home interactions: Tasbih increment, Water +250ml, and Card navigation + Esc return", async () => {
    useIslandStore.setState({ ...INITIAL_ISLAND_CONTEXT, state: "expanded" });
    render(<IslandShell shapeStyle="notch" scaleFactor={1} />);

    const tasbih = await screen.findByTestId("tasbih-chip");
    expect(tasbih).toHaveTextContent("33");
    fireEvent.click(tasbih);
    expect(tasbih).toHaveTextContent("34");

    const waterCard = await screen.findByTestId("home-water-card");
    expect(within(waterCard).getByTestId("water-liquid-visual")).toBeInTheDocument();
    fireEvent.click(waterCard);
    await waitFor(() => {
      expect(waterCard).toHaveTextContent("0.3 L");
    });

    fireEvent.click(screen.getByTestId("home-next-card"));
    expect(await screen.findByTestId("calendar-hub-page")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(await screen.findByTestId("home-page")).toBeInTheDocument();
  });

  it("renders all 7 Home quick shortcuts (Snipping Tool, Screen Record, Focus, Mic, Camera, Lock, Silent Mode) and toggles interactive states", async () => {
    useIslandStore.setState({ ...INITIAL_ISLAND_CONTEXT, state: "expanded" });
    render(<IslandShell shapeStyle="notch" scaleFactor={1} />);

    const expectedKeys = ["screenshot", "record", "focus", "mic", "camera", "lock", "silent"];
    for (const key of expectedKeys) {
      expect(await screen.findByTestId(`home-toggle-${key}`)).toBeInTheDocument();
    }

    const focusBtn = screen.getByTestId("home-toggle-focus");
    expect(focusBtn).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(focusBtn);
    expect(focusBtn).toHaveAttribute("aria-pressed", "true");

    const micBtn = screen.getByTestId("home-toggle-mic");
    expect(micBtn).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(micBtn);
    await waitFor(() => {
      expect(micBtn).toHaveAttribute("aria-pressed", "true");
    });

    const silentBtn = screen.getByTestId("home-toggle-silent");
    expect(silentBtn).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(silentBtn);
    expect(silentBtn).toHaveAttribute("aria-pressed", "true");
  });
});
