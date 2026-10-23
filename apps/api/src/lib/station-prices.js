import { approvedStationPrice, canonicalStationPrices } from './station-approval.js';

// Pending or stale product/unit configurations are not offers customers can buy.
export function publishedStationPrices(station, prices) {
  return canonicalStationPrices(prices).flatMap(price => {
    try {
      const approved = approvedStationPrice(station, price);
      return [{...price, ...approved}];
    } catch (error) {
      if (error.status === 400) return [];
      throw error;
    }
  });
}
