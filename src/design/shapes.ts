/**
 * Generates continuous-curvature SVG paths for Lumen's Notch and Pill shapes (SRS Section 3.4).
 * Never uses plain circular border-radius alone; smooth cubic Bezier curves produce squircle corners.
 */

export interface ShapePathOptions {
  width: number;
  height: number;
  /** Shoulder width for concave inverted top ears in Notch mode. */
  earWidth?: number;
  /** Bottom corner radius before continuous smoothing. */
  bottomRadius?: number;
}

/**
 * Generates a flush-top Notch silhouette with concave inverted top corners
 * and continuous bottom curvature.
 */
export function generateNotchPath({
  width,
  height,
  earWidth = 14,
  bottomRadius = 16,
}: ShapePathOptions): string {
  const safeEar = Math.min(earWidth, Math.floor(width / 6));
  const r = Math.min(bottomRadius, Math.floor(height / 2), Math.floor((width - safeEar * 2) / 2));
  const bodyLeft = safeEar;
  const bodyRight = width - safeEar;
  const handle = r * 0.62;
  const earHandle = safeEar * 0.65;

  return [
    `M 0 0`,
    `C ${earHandle} 0 ${bodyLeft} ${earHandle * 0.45} ${bodyLeft} ${Math.min(safeEar, height * 0.45)}`,
    `L ${bodyLeft} ${height - r}`,
    `C ${bodyLeft} ${height - r + handle} ${bodyLeft + r - handle} ${height} ${bodyLeft + r} ${height}`,
    `L ${bodyRight - r} ${height}`,
    `C ${bodyRight - r + handle} ${height} ${bodyRight} ${height - r + handle} ${bodyRight} ${height - r}`,
    `L ${bodyRight} ${Math.min(safeEar, height * 0.45)}`,
    `C ${bodyRight} ${earHandle * 0.45} ${width - earHandle} 0 ${width} 0`,
    `Z`,
  ].join(" ");
}

/**
 * Generates a floating continuous-curvature squircle Pill path.
 */
export function generatePillPath({ width, height }: ShapePathOptions): string {
  const r = Math.min(height / 2, width / 2);
  const k = r * 0.62;

  return [
    `M ${r} 0`,
    `L ${width - r} 0`,
    `C ${width - r + k} 0 ${width} ${r - k} ${width} ${r}`,
    `L ${width} ${height - r}`,
    `C ${width} ${height - r + k} ${width - r + k} ${height} ${width - r} ${height}`,
    `L ${r} ${height}`,
    `C ${r - k} ${height} 0 ${height - r + k} 0 ${height - r}`,
    `L 0 ${r}`,
    `C 0 ${r - k} ${r - k} 0 ${r} 0`,
    `Z`,
  ].join(" ");
}
