import type {
  Constructor,
  IBound,
  IVec,
  SerializedXYWH,
  XYWH,
} from '@blocksuite/global/utils';

import { BlockSuiteError, ErrorCode } from '@blocksuite/global/exceptions';
import {
  Bound,
  deserializeXYWH,
  getBoundWithRotation,
  getPointsFromBoundWithRotation,
  linePolygonIntersects,
  PointLocation,
  polygonGetPointTangent,
  polygonNearestPoint,
  rotatePoints,
} from '@blocksuite/global/utils';
import { BlockModel } from '@blocksuite/store';

import type { EditorHost } from '../view/index.js';
import type { GfxContainerElement } from './surface/container-element.js';
import type {
  GfxCompatibleProps,
  GfxElementGeometry,
  GfxGroupLikeElementModel,
  GfxPrimitiveElementModel,
  PointTestOptions,
} from './surface/element-model.js';
import type { SurfaceBlockModel } from './surface/surface-model.js';

export class GfxBlockElementModel<
    Props extends GfxCompatibleProps = GfxCompatibleProps,
  >
  extends BlockModel<Props>
  implements GfxElementGeometry, IBound
{
  private _cacheDeserKey: string | null = null;

  private _cacheDeserXYWH: XYWH | null = null;

  private _externalXYWH: SerializedXYWH | undefined = undefined;

  connectable = true;

  rotate = 0;

  get container(): (GfxModel & GfxContainerElement) | null {
    return this.surface?.getContainer(this.id) ?? null;
  }

  get deserializedXYWH() {
    if (this._cacheDeserKey !== this.xywh || !this._cacheDeserXYWH) {
      this._cacheDeserKey = this.xywh;
      this._cacheDeserXYWH = deserializeXYWH(this.xywh);
    }

    return this._cacheDeserXYWH;
  }

  get elementBound() {
    return Bound.from(getBoundWithRotation(this));
  }

  get externalBound(): Bound | null {
    return this._externalXYWH ? Bound.deserialize(this._externalXYWH) : null;
  }

  get externalXYWH(): SerializedXYWH | undefined {
    return this._externalXYWH;
  }

  set externalXYWH(xywh: SerializedXYWH | undefined) {
    this._externalXYWH = xywh;
  }

  get group(): GfxGroupLikeElementModel | null {
    if (!this.surface) return null;

    return this.surface.getGroup(this.id) ?? null;
  }

  get groups(): GfxGroupLikeElementModel[] {
    if (!this.surface) return [];

    return this.surface.getGroups(this.id);
  }

  get h() {
    return this.deserializedXYWH[3];
  }

  get surface(): SurfaceBlockModel | null {
    const result = this.doc.getBlocksByFlavour('affine:surface');
    if (result.length === 0) return null;
    return result[0].model as SurfaceBlockModel;
  }

  get w() {
    return this.deserializedXYWH[2];
  }

  get x() {
    return this.deserializedXYWH[0];
  }

  get y() {
    return this.deserializedXYWH[1];
  }

  containsBound(bounds: Bound): boolean {
    const bound = Bound.deserialize(this.xywh);
    const points = getPointsFromBoundWithRotation({
      x: bound.x,
      y: bound.y,
      w: bound.w,
      h: bound.h,
      rotate: this.rotate,
    });
    return points.some(point => bounds.containsPoint(point));
  }

  getLineIntersections(start: IVec, end: IVec): PointLocation[] | null {
    const bound = Bound.deserialize(this.xywh);

    return linePolygonIntersects(
      start,
      end,
      rotatePoints(bound.points, bound.center, this.rotate ?? 0)
    );
  }

  getNearestPoint(point: IVec): IVec {
    const bound = Bound.deserialize(this.xywh);
    return polygonNearestPoint(
      rotatePoints(bound.points, bound.center, this.rotate ?? 0),
      point
    );
  }

  getRelativePointLocation(relativePoint: IVec): PointLocation {
    const bound = Bound.deserialize(this.xywh);
    const point = bound.getRelativePoint(relativePoint);
    const rotatePoint = rotatePoints(
      [point],
      bound.center,
      this.rotate ?? 0
    )[0];
    const points = rotatePoints(bound.points, bound.center, this.rotate ?? 0);
    const tangent = polygonGetPointTangent(points, rotatePoint);

    return new PointLocation(rotatePoint, tangent);
  }

  includesPoint(
    x: number,
    y: number,
    _: PointTestOptions,
    __: EditorHost
  ): boolean {
    const bound = Bound.deserialize(this.xywh);
    return bound.isPointInBound([x, y], 0);
  }

  intersectsBound(bound: Bound): boolean {
    return (
      this.containsBound(bound) ||
      bound.points.some((point, i, points) =>
        this.getLineIntersections(point, points[(i + 1) % points.length])
      )
    );
  }
}

export function GfxCompatible<
  Props extends GfxCompatibleProps,
  T extends Constructor<BlockModel<Props>> = Constructor<BlockModel<Props>>,
>(BlockModelSuperClass: T) {
  if (BlockModelSuperClass === BlockModel) {
    return GfxBlockElementModel as unknown as typeof GfxBlockElementModel<Props>;
  } else {
    let currentClass = BlockModelSuperClass;

    while (
      Object.getPrototypeOf(currentClass.prototype) !== BlockModel.prototype &&
      Object.getPrototypeOf(currentClass.prototype) !== null
    ) {
      currentClass = Object.getPrototypeOf(currentClass.prototype).constructor;
    }

    if (Object.getPrototypeOf(currentClass.prototype) === null) {
      throw new BlockSuiteError(
        ErrorCode.GfxBlockElementError,
        'The SuperClass is not a subclass of BlockModel'
      );
    }

    Object.setPrototypeOf(
      currentClass.prototype,
      GfxBlockElementModel.prototype
    );
  }

  return BlockModelSuperClass as unknown as typeof GfxBlockElementModel<Props>;
}

export type GfxModel = GfxBlockElementModel | GfxPrimitiveElementModel;
