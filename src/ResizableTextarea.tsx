import { useRef } from "react";
import type { PointerEvent, TextareaHTMLAttributes } from "react";

/** Vertically resizable textarea. Chromium's native resize corner always shows the system cursor, so this
 *  draws its own grip, which follows the app cursor theme. */
export function ResizableTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const drag = useRef<{ pointerId: number; startY: number; startHeight: number; minHeight: number } | null>(null);
  const endDrag = (event: PointerEvent<HTMLSpanElement>) => {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  };
  return (
    <span className="resizable-textarea">
      <textarea ref={textarea} {...props} />
      <span
        className="textarea-resize-grip"
        aria-hidden="true"
        onClick={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          const element = textarea.current;
          if (event.button !== 0 || !element) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = {
            pointerId: event.pointerId,
            startY: event.clientY,
            startHeight: element.getBoundingClientRect().height,
            minHeight: Number.parseFloat(getComputedStyle(element).minHeight) || 0,
          };
        }}
        onPointerMove={(event) => {
          const state = drag.current;
          if (!state || state.pointerId !== event.pointerId || !textarea.current) return;
          textarea.current.style.height = `${Math.max(state.minHeight, state.startHeight + event.clientY - state.startY)}px`;
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      />
    </span>
  );
}
