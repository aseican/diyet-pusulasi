import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

// BMR Calculation (Harris-Benedict Equation)
export const calculateBMR = ({ age, height, weight, gender }) => {
  if (gender === 'male') {
    return 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age);
  } else {
    return 447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age);
  }
};

// TDEE Calculation
export const calculateTDEE = (bmr, activityLevel) => {
  const activityMultipliers = {
    sedentary: 1.2,       // little or no exercise
    light: 1.375,         // light exercise/sports 1-3 days/week
    moderate: 1.55,       // moderate exercise/sports 3-5 days/week
    active: 1.725,        // hard exercise/sports 6-7 days a week
    very_active: 1.9,     // very hard exercise/sports & physical job
  };
  return bmr * (activityMultipliers[activityLevel] || 1.2);
};