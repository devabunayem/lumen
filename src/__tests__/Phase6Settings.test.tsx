import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActionGlowLayer } from "../app/ActionGlowLayer";
import { LumenMascot } from "../app/LumenMascot";
import { DEFAULT_SETTINGS } from "../settings";
import { SettingsWindow } from "../settings/SettingsWindow";

describe("Phase 6 Settings, Mascot & Bangla i18n", () => {
  it("switches to Bangla labels and reorders pages cleanly", () => {
    const onCommit = vi.fn();
    render(<SettingsWindow initialSettings={DEFAULT_SETTINGS} onSettingsCommitted={onCommit} />);

    fireEvent.click(screen.getByRole("button", { name: "বাংলা" }));
    expect(screen.getByText("লুমেন সেটিংস")).toBeInTheDocument();
    expect(onCommit).toHaveBeenCalledWith(expect.objectContaining({ language: "bn" }));

    fireEvent.click(screen.getByRole("button", { name: /পাতা সমূহ/ }));
    expect(screen.getByText(/পাতার ক্রম পরিবর্তন করুন/)).toBeInTheDocument();

    const downButtons = screen.getAllByRole("button", { name: "নিচে" });
    fireEvent.click(downButtons[0]);
    expect(onCommit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pageOrder: [
          "calendar",
          "control",
          "reminders",
          "todo",
          "water",
          "prayer",
          "pomodoro",
          "shelf",
        ],
      }),
    );
  });

  it("renders Lumi mascot moods and hides when disabled", () => {
    const { rerender } = render(<LumenMascot enabled musicPlaying />);
    expect(screen.getByTestId("lumen-mascot")).toHaveAttribute("data-mood", "music");

    rerender(<LumenMascot enabled celebrating />);
    expect(screen.getByTestId("lumen-mascot")).toHaveAttribute("data-mood", "celebrate");

    rerender(<LumenMascot enabled={false} />);
    expect(screen.queryByTestId("lumen-mascot")).toBeNull();
  });

  it("renders Hero Lumi mascot moods & ActionGlowLayer states cleanly", () => {
    const { rerender } = render(<LumenMascot enabled size="hero" mood="wave" />);
    const hero = screen.getByTestId("lumen-mascot");
    expect(hero).toHaveAttribute("data-size", "hero");
    expect(hero).toHaveAttribute("data-mood", "wave");

    const { rerender: rerenderGlow } = render(
      <ActionGlowLayer mode="action" active={false} mood="idle" />,
    );
    expect(screen.queryByTestId("lumen-action-glow")).toBeNull();

    rerenderGlow(<ActionGlowLayer mode="action" active mood="celebrate" />);
    const activeGlow = screen.getByTestId("lumen-action-glow");
    expect(activeGlow).toBeInTheDocument();
    expect(activeGlow).toHaveAttribute("data-mood", "celebrate");

    rerenderGlow(<ActionGlowLayer mode="always" active={false} mood="wave" />);
    expect(screen.getByTestId("lumen-action-glow")).toBeInTheDocument();

    rerenderGlow(
      <ActionGlowLayer mode="always" active={false} mood="music" accentHex="#FF6B4A" paused />,
    );
    const pausedMusicGlow = screen.getByTestId("lumen-action-glow");
    expect(pausedMusicGlow).toHaveAttribute("data-mood", "music");
    expect(pausedMusicGlow).toHaveAttribute("data-paused", "true");

    rerenderGlow(
      <ActionGlowLayer mode="action" active mood="music" accentHex="#FF6B4A" paused={false} />,
    );
    const playingMusicGlow = screen.getByTestId("lumen-action-glow");
    expect(playingMusicGlow).toHaveAttribute("data-mood", "music");
    expect(playingMusicGlow).toHaveAttribute("data-paused", "false");

    rerenderGlow(<ActionGlowLayer mode="off" active mood="wave" />);
    expect(screen.queryByTestId("lumen-action-glow")).toBeNull();

    rerender(<LumenMascot enabled size="hero" mood="sleep" />);
    expect(screen.getByTestId("lumen-mascot")).toHaveAttribute("data-mood", "sleep");
  });
});
