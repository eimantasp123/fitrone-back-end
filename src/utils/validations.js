const yup = require("yup");
const { addIssueToContext } = require("zod");
// Validation Schema
const updateCustomerSchema = yup.object({
  firstName: yup.string().required("First name is required"),
  lastName: yup.string().required("Last name is required"),
  phone: yup.string().required("Phone number is required"),
  email: yup.string().email("Invalid email").required("Email is required"),
  age: yup.number().required("Age is required").positive("Invalid age"),
  height: yup
    .number()
    .required("Height is required")
    .positive("Invalid height"),
  weight: yup
    .number()
    .required("Weight is required")
    .positive("Invalid weight"),
  additionalInfo: yup.string().nullable(), // Optional field
  weightGoal: yup.number().nullable(), // Optional field
  gender: yup.string().required("Gender is required"),
  foodAllergies: yup.string().nullable(), // Optional field
  physicalActivityLevel: yup
    .string()
    .required("Physical activity level is required"),
  fitnessGoal: yup.string().required("Fitness goal is required"),
  preferences: yup
    .array()
    .of(yup.string())
    .required("Dietary preferences are required"),
  restrictions: yup.array().of(yup.string()),
  address: yup.string().required("Address is required"),
  latitude: yup.string().required("Latitude is required"),
  longitude: yup.string().required("Longitude is required"),
});

module.exports = { updateCustomerSchema };
