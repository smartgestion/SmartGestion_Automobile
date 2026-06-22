/**
 * Simple utility to convert numbers to French words
 * This is a basic implementation for Moroccan Dirhams
 */

import writtenNumber from 'written-number'

export function numberToFrenchWords(amount: number): string {
  if (amount === null || amount === undefined || isNaN(amount)) return "";
  
  writtenNumber.defaults.lang = 'fr';
  
  const integerPart = Math.floor(amount);
  const decimalPart = Math.round((amount - integerPart) * 100);
  
  let result = writtenNumber(integerPart);
  
  if (decimalPart > 0) {
    result += ` Dirhams et ${writtenNumber(decimalPart)} Centimes`;
  } else {
    result += ` Dirhams`;
  }
  
  // Capitalize first letter
  return result.charAt(0).toUpperCase() + result.slice(1);
}
