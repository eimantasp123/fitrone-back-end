# 🥗 Nutrition Planning and Order Management System

## Overview

This platform is a full-featured nutrition planning and order management system designed for food producers, meal prep businesses, and dietitians. It allows users to create ingredients, assemble meals, organize them into weekly menus, assign customers, and automatically generate orders for weekly delivery. The system combines structured data flow, subscription-based feature access, and real-time updates to support scalable, personalized meal services.

## 🧭 Use Case & Purpose

The primary use case is to enable producers to efficiently manage recurring meal plans and personalize them for individual customers. This includes:

- Automating weekly menu generation
- Customizing meals based on nutritional needs
- Managing customer preferences and subscriptions
- Generating accurate ingredient lists for production
- Monitoring order status and fulfillment

The system is especially beneficial for teams dealing with recurring nutritional planning (e.g., families, athletes, medical diets) and looking to reduce manual tasks and increase consistency.

---

## 🔧 Core Functional Modules

### 1. **Ingredients Management**
- Producers can create ingredients manually or via AI-assisted input (OpenAI API).
- Ingredients include nutritional values, units, and names (duplicates are restricted).
- Any update to an ingredient triggers backend operations to **recalculate nutritional values** in all related meals.
- Ingredient changes broadcast a WebSocket event (`ingredient_updated_in_meals`) to ensure the frontend reflects updated meal data.
- Supports search, nutritional previews, and soft deletion.

### 2. **Meals**
- Meals are composed of selected ingredients, each contributing to the total nutritional value.
- Producers can add custom images and descriptions.
- Meals can only be created with unique names.
- Meals can be edited or soft-deleted.
- Ingredient modifications automatically propagate recalculations to meals.
- Supports AI-powered ingredient search and meal creation assistance.

### 3. **Weekly Menus**
- A weekly menu is a template that maps meals to days of the week.
- Menus can be created, updated, archived, unarchived, or deleted.
- Each menu is version-controlled; changes do not affect meals in previously active menus.
- Once a menu is assigned to an active plan, it becomes immutable.
- Menus can only be archived if not active, freeing up slot limits.
- Frontend fetches refreshed data after any modification.

### 4. **Weekly Plans**
- Weekly plans are generated based on the producer's timezone and calendar week.
- A weekly plan serves as the live schedule to which menus and customers are assigned.
- Producers can:
  - Assign menus to the week
  - Assign customers to menus
  - Publish plans (which triggers order generation)
- Only one menu can be assigned per week per customer (unless custom plan allows more).
- Plans use validation middleware to check user limits (`checkPlanFeatures`, `checkWeeklyPlanMenu`).
- Published menus cannot be edited; unpublishing is restricted if orders have already started.
- All state changes are synced to the frontend.

### 5. **Customers**
- Customers can be added manually or invited via a secure form sent by email.
- Upon submission, a WebSocket message (`customer_form_confirmed`) informs the producer.
- Producers can:
  - Change a customer's status (active/inactive)
  - Assign menu quantities (e.g., multiple menus per week)
  - Delete or update customer data
- Inactive customers do not count toward plan limits.
- A built-in nutrition calculator estimates recommended intake values for each customer.

### 6. **Order Management**
- When a plan is published, orders are generated per customer and per day.
- Orders determine which ingredients are needed and trigger backend inventory logic.
- Producers can track orders, mark days as completed, and generate prep lists.
- Ingredient stock is managed when publishing/unpublishing a plan (stock checks are done automatically).

---

## 🧩 Subscription & Access Control

The platform includes tier-based access:

- Middleware such as `checkPlanFeatures()` is used throughout to verify if a producer has reached limits for:
  - Ingredients
  - Meals
  - Menus
  - Weekly plans
  - Customers

- When downgrading from a higher-tier plan:
  - Excess data (e.g., meals, ingredients) is archived.
  - Archived **weekly menus** remain visible.
  - Archived **ingredients** and **meals** become inaccessible.

---

## 🔁 Data Flow & Architecture

- **API-first** architecture using RESTful endpoints (`/api/v1`).
- **Soft delete** principle is applied everywhere to preserve data integrity.
- Most calculations (e.g., nutrition, calories) are done **at request time** and not stored permanently.
- Real-time changes (e.g., updated meals, confirmed forms) are communicated using **WebSocket events** to keep client-side data in sync.
- AI integration is used to assist producers with ingredient creation and meal planning (via OpenAI).

---

## 🛠️ Technologies (Optional if Needed)
- Node.js / Express-based backend
- MongoDB with soft delete schema logic
- OpenAI API for AI-enhanced features
- WebSocket (e.g., Socket.IO) for real-time updates
- Middleware logic for subscription validation and plan control
- RESTful API design for frontend integration (possibly React, mobile app, etc.)

---

## ✅ Key Features Summary

- ✅ AI-powered ingredient search and meal suggestions  
- ✅ Dynamic nutritional calculations (ingredient-level updates)  
- ✅ Weekly menu versioning and archiving  
- ✅ Automated weekly plan generation per time zone  
- ✅ Customer self-onboarding via email form  
- ✅ Real-time frontend updates via WebSocket  
- ✅ Order generation and ingredient list compilation  
- ✅ Subscription-tier validation and data archiving  

---

This system is optimized for operational efficiency and scalable nutrition service delivery.

