import type { GroupBy } from '../common/types.js';
import type { PropertyMetaConfig } from '../property/property-config.js';

import { groupByMatcher } from './matcher.js';

export const defaultGroupBy = (
  propertyMeta: PropertyMetaConfig,
  propertyId: string,
  data: NonNullable<unknown>
): GroupBy | undefined => {
  const name = groupByMatcher.match(propertyMeta.config.type(data))?.name;
  return name != null
    ? {
        type: 'groupBy',
        columnId: propertyId,
        name: name,
      }
    : undefined;
};
