/**
 * @ant-design/icons@4 types Pick pointer-capture handlers that are absent from
 * @types/react's ts5.0 DOMAttributes. Without these, icon props are inferred as
 * required and break JSX usage across the app.
 */
import 'react'

declare module 'react' {
  interface DOMAttributes<T> {
    onPointerEnterCapture?: React.PointerEventHandler<T> | undefined
    onPointerLeaveCapture?: React.PointerEventHandler<T> | undefined
  }
}
