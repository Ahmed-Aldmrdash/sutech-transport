import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError, ClientErrorCode, HTTP_STATUS_NONE, ServerErrorCode } from "@/lib/api/errors";
import { renderWithIntl } from "@/test/render";
import { Button } from "./button";
import { ErrorState } from "./error-state";
import { TextField } from "./input";
import { ToastProvider, useToast } from "./toast";

describe("Button", () => {
  it("blocks presses and announces busy while loading", async () => {
    const onClick = vi.fn();
    renderWithIntl(
      <Button isLoading onClick={onClick}>
        Pay now
      </Button>,
    );
    const button = screen.getByRole("button", { name: /pay now/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("defaults to type=button so it never submits a form by accident", () => {
    renderWithIntl(<Button>Save</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });
});

describe("TextField", () => {
  it("links the label and the hint", () => {
    renderWithIntl(<TextField label="University ID" hint="9 digits" />);
    const input = screen.getByLabelText("University ID");
    expect(input).toHaveAccessibleDescription("9 digits");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("shows the error instead of the hint and marks the input invalid", () => {
    renderWithIntl(<TextField label="Mobile" hint="11 digits" error="Enter 11 digits" />);
    const input = screen.getByLabelText("Mobile");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Enter 11 digits");
    expect(screen.queryByText("11 digits")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Enter 11 digits");
  });
});

describe("ErrorState", () => {
  it("explains a lost connection", () => {
    renderWithIntl(
      <ErrorState error={new ApiError(HTTP_STATUS_NONE, ClientErrorCode.Network, "x")} />,
    );
    expect(screen.getByRole("heading")).toHaveTextContent("No connection");
  });

  it("explains a forbidden page, in Arabic too", () => {
    renderWithIntl(<ErrorState error={new ApiError(403, ServerErrorCode.Forbidden, "x")} />, {
      locale: "ar",
    });
    expect(screen.getByRole("heading")).toHaveTextContent("مش مسموح");
  });

  it("offers a retry", async () => {
    const onRetry = vi.fn();
    renderWithIntl(<ErrorState error={new Error("boom")} onRetry={onRetry} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe("Toast", () => {
  function Trigger() {
    const toast = useToast();
    return (
      <Button onClick={() => toast.show({ title: "Saved", tone: "success", durationMs: 1000 })}>
        Show
      </Button>
    );
  }

  it("shows a message and closes it on its own", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderWithIntl(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    act(() => vi.advanceTimersByTime(1100));
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
