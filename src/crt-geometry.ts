import { createRoyaleProjection } from "../public/crt-runtime.js";

const { sqrt, abs } = Math;

export function roundedDistance(x: number, y: number, width: number, height: number, radius: number) {
  const dx = Math.abs(x) - (width / 2 - radius);
  const dy = Math.abs(y) - (height / 2 - radius);
  return Math.hypot(Math.max(0, dx), Math.max(0, dy)) + Math.min(0, Math.max(dx, dy)) - radius;
}

/** Distances from the glass centre to each side of the surrounding cabinet opening. */
type CrtMitreBox = { left: number; right: number; top: number; bottom: number };

/**
 * The shader's bowed silhouette intersected with the player's adjustable rounded clip.
 * With a cabinet box, sharp corners split their walls along the mitre from the glass corner
 * to the cabinet corner instead of along the nearest-edge seam.
 */
export function createCrtGlass(width: number, height: number, radius: number, curvature: number, rotation = 0, mitreBox?: CrtMitreBox) {
  const turn = ((rotation % 360) + 360) % 360;
  const aspect = turn % 180 ? height / width : width / height;
  const projection = curvature > 0 ? createRoyaleProjection(aspect, 10 / curvature) : null;
  const rotate = (u: number, v: number, angle: number) => angle === 90 ? { u: 1 - v, v: u }
    : angle === 180 ? { u: 1 - u, v: 1 - v } : angle === 270 ? { u: v, v: 1 - u } : { u, v };
  const sourcePoint = (x: number, y: number) => {
    if (!projection) return { u: x / width + 0.5, v: y / height + 0.5 };
    const local = rotate(x / width + 0.5, y / height + 0.5, (360 - turn) % 360);
    const source = projection.sourcePoint(local.u, local.v);
    return rotate(source.u, source.v, turn);
  };
  // Curved screens round the picture's own corner, so the radius still applies after it bows inward.
  const inside = (x: number, y: number) => {
    if (!projection) return roundedDistance(x, y, width, height, radius) <= 0;
    const point = sourcePoint(x, y);
    return roundedDistance((point.u - 0.5) * width, (point.v - 0.5) * height, width, height, radius) <= 0;
  };
  const points: { x: number; y: number }[] = [];
  const angles = Array.from({ length: 97 }, (_, index) => index / 96 * Math.PI / 2);
  const corner = projection?.screenPoint(1, 1) ?? { u: 1, v: 1 };
  const displayedCorner = rotate(corner.u, corner.v, turn);
  const cornerAngle = Math.atan2(Math.abs(displayedCorner.v - 0.5) * height, Math.abs(displayedCorner.u - 0.5) * width);
  angles.push(cornerAngle);
  angles.sort((a, b) => a - b);
  const uniqueAngles = angles.filter((value, index) => index === 0 || value - angles[index - 1] > 1e-8);
  const boundary = (angle: number) => {
    const dx = Math.cos(angle), dy = Math.sin(angle);
    let low = 0, high = Math.min(width / (2 * Math.max(dx, 1e-12)), height / (2 * Math.max(dy, 1e-12)));
    for (let step = 0; step < 24; step++) {
      const middle = (low + high) / 2;
      if (inside(dx * middle, dy * middle)) low = middle; else high = middle;
    }
    return { x: dx * low, y: dy * low };
  };
  // Small corner arcs span a tiny angle from the centre, so subdivide until the outline is within 0.1 px.
  const samples: { angle: number; point: { x: number; y: number } }[] = [];
  const refine = (a0: number, p0: { x: number; y: number }, a1: number, p1: { x: number; y: number }, depth: number) => {
    const angle = (a0 + a1) / 2, point = boundary(angle);
    const cx = p1.x - p0.x, cy = p1.y - p0.y, chord = Math.hypot(cx, cy);
    const deviation = chord > 1e-9 ? Math.abs((point.x - p0.x) * cy - (point.y - p0.y) * cx) / chord : 0;
    if (depth < 14 && deviation > 0.1) {
      refine(a0, p0, angle, point, depth + 1);
      refine(angle, point, a1, p1, depth + 1);
    } else samples.push({ angle: a1, point: p1 });
  };
  let previous = { angle: uniqueAngles[0], point: boundary(uniqueAngles[0]) };
  samples.push(previous);
  for (const angle of uniqueAngles.slice(1)) {
    const next = { angle, point: boundary(angle) };
    refine(previous.angle, previous.point, next.angle, next.point, 0);
    previous = next;
  }
  let apex = 0;
  samples.forEach((sample, index) => {
    points.push(sample.point);
    if (Math.abs(sample.angle - cornerAngle) < Math.abs(samples[apex].angle - cornerAngle)) apex = index;
  });
  const segments = points.slice(0, -1).map((a, index) => {
    const b = points[index + 1], dx = b.x - a.x, dy = b.y - a.y;
    const length2 = dx * dx + dy * dy, length = sqrt(length2);
    return { x: a.x, y: a.y, dx, dy, length2, nx: dy / length, ny: -dx / length };
  });
  type EdgeNode = { start: number; end: number; minX: number; maxX: number; minY: number; maxY: number; children?: [EdgeNode, EdgeNode] };
  const buildTree = (start: number, end: number): EdgeNode => {
    const node: EdgeNode = { start, end, minX: points[end].x, maxX: points[start].x, minY: points[start].y, maxY: points[end].y };
    if (end - start > 3) {
      const middle = (start + end) >> 1;
      node.children = [buildTree(start, middle), buildTree(middle, end)];
    }
    return node;
  };
  const tree = buildTree(0, segments.length);
  // Segments before the apex form the side wall, the rest the top/bottom wall.
  const sharp = radius <= 0 && apex > 0 && apex < segments.length
    && segments[apex - 1].nx * segments[apex].nx + segments[apex - 1].ny * segments[apex].ny < Math.cos(Math.PI / 12);
  const nearest = (x: number, y: number, mitred = false) => {
    const ax = abs(x), ay = abs(y);
    let first = 0, last = segments.length;
    if (mitred && sharp && mitreBox) {
      const cornerX = x < 0 ? mitreBox.left : mitreBox.right, cornerY = y < 0 ? mitreBox.top : mitreBox.bottom;
      const apexX = points[apex].x, apexY = points[apex].y;
      if ((cornerX - apexX) * (ay - apexY) - (cornerY - apexY) * (ax - apexX) > 0) first = apex; else last = apex;
    }
    let best = Infinity, px = 0, py = 0, nx = 0, ny = 0;
    const bound = (node: EdgeNode) => {
      const dx = ax < node.minX ? node.minX - ax : ax > node.maxX ? ax - node.maxX : 0;
      const dy = ay < node.minY ? node.minY - ay : ay > node.maxY ? ay - node.maxY : 0;
      return dx * dx + dy * dy;
    };
    const visit = (node: EdgeNode, distanceBound: number) => {
      if (distanceBound > best || node.end <= first || node.start >= last) return;
      if (node.children) {
        const [a, b] = node.children, da = bound(a), db = bound(b);
        if (da < db) { visit(a, da); visit(b, db); } else { visit(b, db); visit(a, da); }
        return;
      }
      for (let index = Math.max(node.start, first); index < Math.min(node.end, last); index++) {
        const segment = segments[index];
        const position = ((ax - segment.x) * segment.dx + (ay - segment.y) * segment.dy) / segment.length2;
        const t = position < 0 ? 0 : position > 1 ? 1 : position;
        const qx = segment.x + segment.dx * t, qy = segment.y + segment.dy * t;
        const distance = (ax - qx) ** 2 + (ay - qy) ** 2;
        if (distance < best) {
          best = distance; px = qx; py = qy;
          nx = segment.nx; ny = segment.ny;
        }
      }
    };
    visit(tree, bound(tree));
    const signX = x < 0 ? -1 : 1, signY = y < 0 ? -1 : 1;
    const distance = ((ax - px) * nx + (ay - py) * ny < 0 ? -1 : 1) * sqrt(best);
    // Outside a rounded outline, point from the edge towards the pixel so shading has no seams between segments.
    if (distance > 1e-6 && first === 0 && last === segments.length) {
      nx = (ax - px) / distance; ny = (ay - py) / distance;
    }
    return { x: px * signX, y: py * signY, nx: nx * signX, ny: ny * signY, distance };
  };
  const halfWidthAt = (y: number) => {
    const ay = Math.abs(y);
    if (ay > points[points.length - 1].y) return 0;
    let low = 0, high = points.length - 1;
    while (high - low > 1) {
      const middle = (low + high) >> 1;
      if (points[middle].y < ay) low = middle; else high = middle;
    }
    const a = points[low], b = points[high];
    const t = b.y === a.y ? 0 : (ay - a.y) / (b.y - a.y);
    return a.x + (b.x - a.x) * t;
  };
  return { nearest, sourcePoint, inside, halfWidthAt, outline: points };
}
