### **Customers Controller - Backend Logic & Flow**

# **Customer Management Flow in Backend**

This document explains the logic and flow of customer management in the backend, including customer creation, updates, validation, group management, nutrition calculation, and order dependencies.

---

## **1. Overview**

The **Customers Controller** is responsible for managing customer-related operations, ensuring data integrity, and handling the dependencies between customers, groups, orders and week plans.

---

## **2. Core Functionalities & Flow**

### **2.1 Customer Creation**

- A supplier can create a customer **manually** (`createCustomerManually`) or by **sending a form to the customer** (`sendFormToCustomer`).
- Before creating a customer:
  - The email and first name must be provided.
  - The system checks if a customer already exists for the supplier (prevents duplicates).
  - The request body is validated against predefined rules.
- A new customer is created with:
  - Status: `"active"` (for manual creation) or `"pending"` (when form is sent).
  - Default weekly menu quantity (`weeklyMenuQuantity = 1`).

#### **Flow:**

1. Validate input.
2. Check if the customer exists.
3. If not, create and store the customer in the database.
4. Send a success response.

---

### **2.2 Sending and Resending Forms**

- A supplier can send a form to a **new customer** (`sendFormToCustomer`).
- A **pending customer** can be resent a form (`resendFormToCustomer`).
- A **confirmation token** is generated and sent via email.
- AWS **SQS (Simple Queue Service)** is used to send the email asynchronously.

#### **Flow:**

1. Validate email and first name.
2. Check if the customer already exists.
3. If not, create a pending customer and generate a confirmation token.
4. Send the confirmation email via SQS.

---

### **2.3 Customer Form Confirmation**

- When a customer completes the form (`confirmCustomerForm`), their details are validated and stored.
- The confirmation token is **hashed** and verified against the database.
- The form can only be confirmed if:
  - The **token is valid**.
  - The customer status is `"pending"`.
  - The recaptcha verification succeeds.
- After confirmation, the **customer status is changed to `"active"`**, and form token fields are cleared.

#### **Flow:**

1. Verify **Recaptcha** for security.
2. Check if the token exists and is still valid.
3. Validate customer data and update in the database.
4. Send a **websocket message** to notify the supplier.

---

### **2.4 Customer Updates**

- A supplier can update customer details (`updateCustomer`).
- Only **valid fields** are allowed (validated via schema).
- Certain fields (like `status`) are automatically updated based on the current state.

#### **Flow:**

1. Validate incoming update fields.
2. Find the customer by ID.
3. If found, apply changes and save.

---

### **2.5 Customer Deletion & Dependency Management**

- A customer can only be **deleted** (`deleteCustomer`) if they are **not assigned** to an active week plan and **not assigned** to group which is attached to active week plan.
- If assigned to a **group**, they are removed from the group before deletion.
- A dedicated **DeleteService** handles deletion in multiple places.

#### **Flow:**

1. Check if the customer exists.
2. Ensure they are not attached to an **active week plan**.
3. Ensure they are not attached to a group which is attached to an **active week plan**.
4. Remove them from **groups** if needed.
5. Delete the customer from the database.

---

### **2.6 Managing Customer Status**

- A supplier can **activate or deactivate** a customer (`changeCustomerStatus`).
- **If status is changed to "inactive"**, the system checks:
  - If the customer is in an **active week plan**, prevent deactivation.
  - If they belong to a **group attached to an active week plan**, prevent deactivation.
  - If neither applies, allow status change.

#### **Flow:**

1. Validate the request.
2. Check if the customer exists.
3. If **already in an active week plan**, throw an error.
4. If **in a group assigned to an active week plan**, throw an error.
5. If conditions are met, update status.

---

### **2.7 Assigning Customer Menu Quantity**

- The default **weekly menu quantity** for each customer is `1`.
- A supplier can increase this quantity (`changeCustomerMenuQuantity`).
- If a **customer is part of a group**, **quantity cannot be changed**.
- If they are **already assigned to an active week plan**, quantity **cannot be changed**.

#### **Flow:**

1. Validate request.
2. Ensure the customer is **not in a group**.
3. Ensure the customer **is not assigned to an active week plan**.
4. Update the **weekly menu quantity**.

---

### **2.8 Calculating Customer Nutrition Intake**

- Based on the customer's details (age, weight, height, activity level, and goal), the system calculates the **recommended nutrition**.
- The calculation is done via the `calculateDailyNutritionIntake` function.
- If nutrition calculation **fails**, an error is returned.

#### **Flow:**

1. Check if the customer exists.
2. Validate required fields (age, weight, height, etc.).
3. Calculate daily nutrition intake.
4. Store the recommended nutrition in the database.

---

## **3. Data Dependencies and Integrity**

Since customers are linked to **groups, week plans, and orders**, we prevent unwanted deletions or modifications that can break existing data relationships.

### **Prevention Measures**

✅ **Prevent Deleting Customers Assigned to Active Week Plans**  
✅ **Ensure Customers in a Group Cannot Have Menu Quantity Changed**  
✅ **Restrict Changing Status If Customer Is in an Active Plan**

### **Handling Data Changes**

- **When a customer is added to a group**, they inherit group properties.
- **If a customer is removed from a group**, they must be **manually assigned to a weekly menu**.
- **If a customer is deactivated**, they are automatically **removed from groups**.

---

## **4. Summary of Key Business Rules**

| Feature                   | Key Rules                                                           |
| ------------------------- | ------------------------------------------------------------------- |
| **Customer Creation**     | Email & first name required, no duplicates                          |
| **Sending Forms**         | Creates a "pending" customer, uses SQS for async email              |
| **Confirming Forms**      | Token-based validation, Recaptcha required                          |
| **Updating Customers**    | Only valid fields updated, status auto-adjusts                      |
| **Deleting Customers**    | Not allowed if assigned to an active week plan                      |
| **Changing Status**       | Prevent deactivation if customer is assigned to active plans/groups |
| **Menu Quantity Change**  | Allowed only for customers not in groups or active plans            |
| **Nutrition Calculation** | Based on fitness goals, age, height, weight, activity               |

---

## **5. Conclusion**

This controller ensures **data consistency** while allowing suppliers to manage their customers efficiently. It prevents incorrect assignments, enforces business rules, and ensures **automated updates** to maintain **data integrity**.
