const { EventEmitter } = require("node:events");

// Auxiliary pages keep their own isolated preload/IPC sender, but are child views, not OS windows.
function createPanelManager({ WebContentsView, BrowserWindow, getDefaultOwner, getTopInset = () => 0, onCreated = () => {} }) {
  const panels = new Map();
  const hosts = new Map();
  const nativeOwner = owner => owner?.isPanel ? owner.host : owner;
  const live = surface => surface && !surface.isDestroyed();
  const hostState = host => {
    let state = hosts.get(host);
    if (state) return state;
    state = { panels: [], focused: null };
    hosts.set(host, state);
    const layout = () => {
      for (const panel of state.panels) panel.layout();
    };
    for (const event of ["resize", "enter-full-screen", "leave-full-screen"]) host.on(event, layout);
    host.once("closed", () => {
      for (const panel of [...state.panels]) panel.destroy();
      hosts.delete(host);
    });
    return state;
  };
  const backdropFor = host => {
    const state = hosts.get(host);
    const visible = state?.panels.filter(panel => panel.visible && !panel.destroyed) ?? [];
    if (!visible.some(panel => panel.dimBackground)) return null;
    const panel = state?.focused && visible.includes(state.focused) ? state.focused : visible[visible.length - 1];
    return panel ? { id: panel.id, dismissible: panel.backdropDismissible } : null;
  };
  const notifyBackdrop = host => {
    if (!live(host) || host.webContents.isDestroyed() || typeof host.webContents.send !== "function") return;
    const state = hosts.get(host);
    host.webContents.send("panel:visibility", Boolean(state?.panels.some(panel => panel.visible && !panel.destroyed)));
    host.webContents.send("panel:backdrop", backdropFor(host));
  };

  class Panel extends EventEmitter {
    constructor(options, owner = options.parent || getDefaultOwner()) {
      super();
      if (!live(owner) || !live(nativeOwner(owner))) throw new Error("Cannot open a panel without a live Library or player window.");
      this.isPanel = true;
      this.destroyed = false;
      this.visible = false;
      this.maximized = false;
      this.dimRequested = options.dimBackground === true;
      this.backdropDismissible = options.backdropDismissible !== false;
      this.dimBackground = false;
      this.title = options.title || "";
      this.minimum = [options.minWidth || Math.min(options.width || 320, 320), options.minHeight || 120];
      this.backgroundThrottling = options.webPreferences?.backgroundThrottling !== false;
      this.view = new WebContentsView({ webPreferences: {
        ...options.webPreferences,
        additionalArguments: [...(options.webPreferences?.additionalArguments || []), "--flash-royale-panel"],
        // A detached view can otherwise freeze before loadURL resolves when the Library is hidden for a game.
        backgroundThrottling: false,
      } });
      this.webContents = this.view.webContents;
      this.id = this.webContents.id;
      this.view.setBackgroundColor(options.backgroundColor || "#101318");
      panels.set(this.id, this);
      this.setOwner(owner);
      const area = this.getAvailableBounds();
      this.bounds = {
        x: Number.isFinite(options.x) ? options.x : Math.round((area.width - (options.width || 620)) / 2),
        y: Number.isFinite(options.y) ? options.y : area.y + Math.round((area.height - (options.height || 440)) / 2),
        width: options.width || 620, height: options.height || 440,
      };
      this.normalBounds = { ...this.bounds };
      this.layout();
      this.webContents.on("close", () => this.close());
      this.webContents.on("destroyed", () => this.finishDestroy());
      this.webContents.on("focus", () => this.notifyFocus());
      this.webContents.on("blur", () => {
        const state = hosts.get(this.host);
        if (state?.focused === this) state.focused = null;
        notifyBackdrop(this.host);
        this.emit("blur");
      });
      this.webContents.on("did-finish-load", () => this.emit("ready-to-show"));
      onCreated(this);
      if (options.show !== false) this.show();
    }
    setOwner(owner) {
      if (!live(owner)) throw new Error("Cannot open a panel without a live Library or player window.");
      for (let ancestor = owner; ancestor?.isPanel; ancestor = ancestor.owner) {
        if (ancestor === this) return;
      }
      const host = nativeOwner(owner);
      const oldHost = this.host;
      if (this.host && this.host !== host) {
        this.host.contentView.removeChildView(this.view);
        const old = hostState(this.host);
        old.panels = old.panels.filter(panel => panel !== this);
        if (old.focused === this) old.focused = null;
      }
      this.owner = owner;
      this.dimBackground = this.dimRequested && host === nativeOwner(getDefaultOwner());
      if (this.host !== host) {
        this.host = host;
        hostState(host).panels.push(this);
        if (this.visible) host.contentView.addChildView(this.view);
        if (this.bounds) this.layout();
        for (const child of panels.values()) if (child.owner === this) child.setOwner(this);
      }
      if (oldHost && oldHost !== host) notifyBackdrop(oldHost);
      notifyBackdrop(host);
    }
    layout() {
      if (this.destroyed || !this.bounds || !live(this.host)) return;
      const { y, width, height } = this.getAvailableBounds();
      const fit = bounds => {
        const w = Math.min(width, Math.max(Math.min(this.minimum[0], width), Math.round(bounds.width)));
        const h = Math.min(height, Math.max(Math.min(this.minimum[1], height), Math.round(bounds.height)));
        return { x: Math.max(0, Math.min(width - w, Math.round(bounds.x))),
          y: Math.max(y, Math.min(y + height - h, Math.round(bounds.y))), width: w, height: h };
      };
      this.bounds = this.maximized ? { x: 0, y, width, height } : fit(this.bounds);
      if (!this.maximized) this.normalBounds = { ...this.bounds };
      this.view.setBounds(this.bounds);
    }
    setBounds(bounds) {
      const before = this.getBounds();
      this.bounds = { ...this.bounds, ...bounds };
      this.layout();
      if (before.x !== this.bounds.x || before.y !== this.bounds.y) this.emit("move");
      if (before.width !== this.bounds.width || before.height !== this.bounds.height) this.emit("resize");
    }
    getBounds() { return { ...this.bounds }; }
    getContentBounds() { return this.getBounds(); }
    getNormalBounds() { return { ...this.normalBounds }; }
    getSize() { return [this.bounds.width, this.bounds.height]; }
    getMinimumSize() {
      const area = this.getAvailableBounds();
      return [Math.min(this.minimum[0], area.width), Math.min(this.minimum[1], area.height)];
    }
    getAvailableBounds() {
      const { width, height } = this.host.getContentBounds();
      const top = Math.min(height, Math.max(0, getTopInset(this.host)));
      return { x: 0, y: top, width, height: height - top };
    }
    setPosition(x, y) { this.setBounds({ x, y }); }
    center() {
      const area = this.getAvailableBounds();
      this.setPosition(Math.round((area.width - this.bounds.width) / 2), area.y + Math.round((area.height - this.bounds.height) / 2));
    }
    isDestroyed() { return this.destroyed; }
    isVisible() { return this.visible && live(this.host) && this.host.isVisible(); }
    isMinimized() { return !this.visible; }
    isMaximized() { return this.maximized; }
    isFullScreen() { return false; }
    isSimpleFullScreen() { return false; }
    isResizable() { return true; }
    isMovable() { return true; }
    isMaximizable() { return true; }
    isFocused() {
      return !this.destroyed && this.visible && live(this.host) && !this.webContents.isDestroyed()
        && this.host.isFocused() && this.webContents.isFocused();
    }
    setMenu() {}
    setTitle(title) { this.title = title; }
    loadURL(...args) { return this.webContents.loadURL(...args); }
    loadFile(...args) { return this.webContents.loadFile(...args); }
    show() {
      if (this.destroyed) return;
      if (!this.visible) {
        this.visible = true;
        this.host.contentView.addChildView(this.view);
        this.webContents.setBackgroundThrottling(this.backgroundThrottling);
        this.emit("show");
        notifyBackdrop(this.host);
      }
      this.layout();
    }
    showInactive() { this.show(); }
    restore() { this.show(); this.emit("restore"); }
    moveTop() {
      if (!this.visible || this.destroyed) return;
      this.host.contentView.addChildView(this.view);
      for (const child of panels.values()) if (child.owner === this) child.moveTop();
    }
    notifyFocus() {
      if (this.destroyed) return;
      const state = hostState(this.host);
      if (state.focused === this) return;
      const previous = state.focused;
      state.focused = this;
      previous?.emit("blur");
      this.moveTop();
      notifyBackdrop(this.host);
      this.emit("focus");
    }
    setBackdropDismissible(enabled) {
      this.backdropDismissible = enabled;
      notifyBackdrop(this.host);
    }
    focus() {
      if (this.destroyed) return;
      if (this.host.isMinimized()) this.host.restore();
      this.host.show();
      this.show();
      this.moveTop();
      this.host.focus();
      this.webContents.focus();
      this.notifyFocus();
    }
    hide() {
      if (!this.visible || this.destroyed) return;
      const focused = this.isFocused();
      this.visible = false;
      if (live(this.host)) this.host.contentView.removeChildView(this.view);
      for (const child of panels.values()) if (child.owner === this) child.hide();
      if (hostState(this.host).focused === this) hostState(this.host).focused = null;
      this.emit("blur");
      this.emit("hide");
      notifyBackdrop(this.host);
      if (focused) this.focusOwner();
    }
    minimize() { this.hide(); this.emit("minimize"); }
    maximize() { this.maximized = true; this.layout(); this.emit("maximize"); }
    unmaximize() { this.maximized = false; this.bounds = { ...this.normalBounds }; this.layout(); this.emit("unmaximize"); }
    setFullScreen(enabled) { if (enabled) this.maximize(); else if (this.maximized) this.unmaximize(); }
    focusOwner() {
      if (!live(this.host) || !this.host.isFocused()) return;
      let owner = this.owner;
      while (owner?.isPanel && (!live(owner) || !owner.visible)) owner = owner.owner;
      if (live(owner) && owner.isPanel) owner.focus();
      else this.host.webContents.focus();
    }
    close() {
      if (this.destroyed) return;
      let cancelled = false;
      this.emit("close", { preventDefault() { cancelled = true; } });
      if (!cancelled) this.destroy();
    }
    destroy() {
      if (this.destroyed) return;
      const focused = this.isFocused();
      this.finishDestroy();
      if (!this.webContents.isDestroyed()) this.webContents.close({ waitForBeforeUnload: false });
      if (focused) this.focusOwner();
    }
    finishDestroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      for (const child of [...panels.values()]) if (child.owner === this) child.destroy();
      if (live(this.host)) this.host.contentView.removeChildView(this.view);
      const state = hosts.get(this.host);
      if (state) {
        state.panels = state.panels.filter(panel => panel !== this);
        if (state.focused === this) state.focused = null;
      }
      panels.delete(this.id);
      notifyBackdrop(this.host);
      this.emit("closed");
    }
  }
  return {
    Panel,
    all: () => [...panels.values()],
    hasVisible: owner => {
      const host = nativeOwner(owner);
      return Boolean(hosts.get(host)?.panels.some(panel => panel.visible && !panel.destroyed));
    },
    isBackdropTarget: (host, id) => backdropFor(host)?.id === id,
    fromWebContents: contents => panels.get(contents.id) || BrowserWindow.fromWebContents(contents)
      || BrowserWindow.getAllWindows().find(host => host.contentView.children.some(view => view.webContents === contents)),
    getFocusedWindow: () => {
      const host = BrowserWindow.getFocusedWindow();
      return hosts.get(host)?.panels.find(panel => panel.isFocused()) || host;
    },
  };
}

module.exports = { createPanelManager };
