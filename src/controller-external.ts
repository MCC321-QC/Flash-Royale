type ControllerExternalKind = "app" | "onlineGame" | "externalPlayer";

export type ControllerExternalRequest = {
  kind: ControllerExternalKind;
  resolve: (confirmed: boolean) => void;
};

/** Resolves `false` when the controller user declined, `true` once the action ran. */
export async function outsideControllerApp(action: () => Promise<void>, kind: ControllerExternalKind = "app"): Promise<boolean> {
  if (document.documentElement.classList.contains("controller-navigation-active")) {
    const confirmed = await new Promise<boolean>(resolve => {
      window.dispatchEvent(new CustomEvent<ControllerExternalRequest>("controller-confirm-external", { detail: { kind, resolve } }));
    });
    if (!confirmed) return false;
  }
  await action();
  return true;
}
