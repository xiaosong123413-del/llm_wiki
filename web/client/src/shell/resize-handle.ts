interface ResizeHandleOptions {
  handle: HTMLElement;
  onMove: (event: MouseEvent) => void;
  onEnd?: (event: MouseEvent) => void;
}

export function attachResizeHandle(options: ResizeHandleOptions): () => void {
  const { handle, onMove, onEnd } = options;
  let active = false;

  const stopDragging = (event: MouseEvent): void => {
    if (!active) {
      return;
    }
    active = false;
    document.body.classList.remove("panel-resize-active");
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", stopDragging);
    onEnd?.(event);
  };

  const onMouseMove = (event: MouseEvent): void => {
    if (!active) {
      return;
    }
    onMove(event);
  };

  const onMouseDown = (event: MouseEvent): void => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    active = true;
    document.body.classList.add("panel-resize-active");
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", stopDragging);
  };

  handle.addEventListener("mousedown", onMouseDown);
  return () => {
    handle.removeEventListener("mousedown", onMouseDown);
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", stopDragging);
    document.body.classList.remove("panel-resize-active");
  };
}
