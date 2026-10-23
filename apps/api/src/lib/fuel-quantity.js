import { sellingUnitLabel } from '../../../../packages/shared/partner-access.mjs';

export function quantityLabel(value, sellingUnit) {
  const text=String(value??'0');
  if(!/^\d+(?:\.\d+)?$/.test(text))throw new Error('Fuel quantity must be a nonnegative decimal');
  const [whole,fraction='']=text.split('.');
  const decimals=fraction.replace(/0+$/,'');
  return `${BigInt(whole).toLocaleString('en-NG')}${decimals?`.${decimals}`:''} ${sellingUnitLabel(sellingUnit)}`;
}

// SQL groups each physical unit before these values reach the presentation layer.
export function quantityTotalsLabel({litres=0,kg=0,scm=0}={}) {
  const groups=[[litres,'litre'],[kg,'kg'],[scm,'scm']].filter(([value])=>/[1-9]/.test(String(value)));
  return groups.length?groups.map(([value,unit])=>quantityLabel(value,unit)).join(' · '):'No fuel recorded';
}
