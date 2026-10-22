// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CopyButton,
  ConfirmButton,
  ErrorMessage,
} from "../../src/components/common";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe("shared interaction components", () => {
  it("copies the complete link including the encryption fragment", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(<CopyButton value="https://relay.example/d/id#key=private" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    await screen.findByText("Copied!");
    expect(writeText).toHaveBeenCalledWith(
      "https://relay.example/d/id#key=private",
    );
  });
  it("offers a selected manual-copy input when clipboard access is denied", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    render(<CopyButton value="full-private-link" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    const input = await screen.findByRole("textbox", { name: /Copy manually/ });
    await waitFor(() => expect(input).toHaveFocus());
    expect(input).toHaveValue("full-private-link");
  });
  it("announces errors and requires explicit destructive confirmation", async () => {
    const confirm = vi.fn().mockResolvedValue(undefined);
    render(
      <>
        <ErrorMessage message="Please retry" />
        <ConfirmButton
          label="Delete share"
          title="Take it back?"
          description="This cannot be undone."
          onConfirm={confirm}
        />
      </>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Please retry");
    fireEvent.click(screen.getByRole("button", { name: "Delete share" }));
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Take it back?");
    fireEvent.click(
      screen.getAllByRole("button", { name: "Delete share" }).at(-1)!,
    );
    await waitFor(() => expect(confirm).toHaveBeenCalledOnce());
  });
});
