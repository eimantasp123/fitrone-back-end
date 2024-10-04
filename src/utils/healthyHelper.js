// Calculate daily calories intake based on user's input
const calculateDailyCaloriesIntake = ({
  gender,
  age,
  height,
  weight,
  fitnessGoal,
  physicalActivityLevel,
}) => {
  let BMR;

  if (gender === "male") {
    BMR = 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    BMR = 10 * weight + 6.25 * height - 5 * age - 161;
  }
  const activityLevel = {
    sedentary: 1.2,
    lightlyActive: 1.375,
    moderatelyActive: 1.55,
    veryActive: 1.725,
  };

  const dailyCaloriesIntake = BMR * activityLevel[physicalActivityLevel];

  let adjustedCalorieIntake;

  switch (fitnessGoal) {
    case "weightMaintenance":
      adjustedCalorieIntake = dailyCaloriesIntake;
      break;
    case "weightLoss":
      adjustedCalorieIntake = dailyCaloriesIntake * 0.8;
      break;
    case "weightGain":
      adjustedCalorieIntake = dailyCaloriesIntake * 1.15;
      break;
    case "weightLossAndMuscleGain":
      adjustedCalorieIntake = dailyCaloriesIntake * 0.9;
      break;
    default:
      adjustedCalorieIntake = dailyCaloriesIntake;
  }

  let proteingGramsPerKg, fatPercentage;

  switch (fitnessGoal) {
    case "weightMaintenance":
      proteingGramsPerKg = 2;
      fatPercentage = 0.25;
      break;
    case "weightLoss":
      proteingGramsPerKg = 2;
      fatPercentage = 0.25;
      break;
    case "weightGain":
      proteingGramsPerKg = 2.2;
      fatPercentage = 0.22;
      break;
    case "weightLossAndMuscleGain":
      proteingGramsPerKg = 2.2;
      fatPercentage = 0.2;
      break;
    default:
      throw new Error("Invalid fitness goal");
  }

  // Calculate macronutrients
  const protein = weight * proteingGramsPerKg;
  const proteinCalories = protein * 4;

  // Calculate fat
  const fatCalories = adjustedCalorieIntake * fatPercentage;
  const fat = fatCalories / 9;

  // Calculate carbs
  const carbsCalories = adjustedCalorieIntake - proteinCalories - fatCalories;
  const carbs = carbsCalories / 4;

  return {
    kcal: Math.round(adjustedCalorieIntake),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
    protein: Math.round(protein),
  };
};

// Calculate macronutrient targerts for each meal
const calculateMealMacronutrients = (
  calories,
  protein,
  fat,
  carbs,
  mainMeals,
  snacks,
) => {
  let snacksPercentage;

  // If no snacks then all calories are for main meals
  if (snacks === 0) {
    snacksPercentage = 0;

    // If more snacks than main meals then main meals get 75% of calories
  } else if (snacks > mainMeals && mainMeals <= 2) {
    snacksPercentage = snacks * 0.17;
    //
  } else if (snacks > mainMeals && mainMeals > 2) {
    snacksPercentage = snacks * 0.15;

    // If more main meals than snacks then snacks get 50%
  } else if (mainMeals > snacks && snacks <= 2) {
    snacksPercentage = snacks * 0.1;

    // If equal number of main meals and snacks then main meals get 60%
  } else {
    snacksPercentage = 0.4;
  }

  let mainMealsPercentage = 1 - snacksPercentage;

  mainMealsPercentage.toFixed(2);
  snacksPercentage.toFixed(2);

  // 2. Split macronutrients between main meals and snacks
  const mainMealsCalories = calories * mainMealsPercentage;
  const snacksCalories = calories * snacksPercentage;

  const mainMealsProtein = protein * mainMealsPercentage;
  const snacksProtein = protein * snacksPercentage;

  const mainMealsFat = fat * mainMealsPercentage;
  const snacksFat = fat * snacksPercentage;

  const mainMealsCarbs = carbs * mainMealsPercentage;
  const snacksCarbs = carbs * snacksPercentage;

  // 3. Calculate macronutrients for each meal

  const mainMealsCaloriesPerMeal = mainMealsCalories / mainMeals;
  const snacksCaloriesPerMeal = snacksCalories / snacks;

  const mainMealsProteinPerMeal = mainMealsProtein / mainMeals;
  const snacksProteinPerMeal = snacksProtein / snacks;

  const mainMealsFatPerMeal = mainMealsFat / mainMeals;
  const snacksFatPerMeal = snacksFat / snacks;

  const mainMealsCarbsPerMeal = mainMealsCarbs / mainMeals;
  const snacksCarbsPerMeal = snacksCarbs / snacks;

  // 4. Return macronutrients for each meal in an object

  const mainMealsArray = [];
  const snacksArray = [];

  for (let i = 0; i < mainMeals; i++) {
    mainMealsArray.push({
      calories: mainMealsCaloriesPerMeal.toFixed(0),
      protein: mainMealsProteinPerMeal.toFixed(0),
      fat: mainMealsFatPerMeal.toFixed(0),
      carbs: mainMealsCarbsPerMeal.toFixed(0),
    });
  }

  if (snacks !== 0) {
    for (let i = 0; i < snacks; i++) {
      snacksArray.push({
        calories: snacksCaloriesPerMeal.toFixed(0),
        protein: snacksProteinPerMeal.toFixed(0),
        fat: snacksFatPerMeal.toFixed(0),
        carbs: snacksCarbsPerMeal.toFixed(0),
      });
    }
  }

  return {
    mainMeals: mainMealsArray,
    snacks: snacksArray,
  };
};

module.exports = { calculateDailyCaloriesIntake, calculateMealMacronutrients };
