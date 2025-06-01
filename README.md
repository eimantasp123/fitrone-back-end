Nutrition Planning and Order Management Platform – System Overview

This system is a custom-built web platform designed for nutrition-focused meal producers to streamline the planning, creation, and delivery of personalized meal plans. It serves as an internal operational tool that automates and connects the full workflow — from ingredient management to final order fulfillment for end customers.

🧩 Purpose of the System
The platform helps small to medium-scale food producers, dietitians, and subscription-based meal services manage complex weekly meal planning and customer personalization at scale. It replaces manual spreadsheets or fragmented tools with a structured, API-driven backend and real-time frontend sync.

⚙️ How the System Works
The system is structured around several core modules, each representing a key step in the meal planning lifecycle:

Ingredient Management

Producers can manually add ingredients or use AI (OpenAI API) to generate them.

Nutritional values are stored and dynamically recalculated when updated.

All meals using an updated ingredient are automatically recalculated via backend operations.

WebSocket notifications are used to trigger frontend refreshes in real time.

Meal Creation

Meals are composed of ingredients and include nutritional metadata and images.

Duplicate names are not allowed, and meals can be edited or soft-deleted.

AI can assist in searching and generating ingredients during meal creation.

Weekly Menu Builder

Weekly menus are built by assigning meals to specific days.

Each menu is versioned, can be archived, and is linked to future weekly plans.

Once a menu is made “active” (assigned to a weekly plan), it becomes immutable.

Weekly Plans

Automatically generated weekly timelines that assign menus and customers.

Producers must set their time zone first; plan creation then happens dynamically.

Includes logic for publishing/unpublishing menus, with strict validation (e.g., already completed orders block unpublishing).

Menus and customers are linked with validation via middleware that checks plan limits.

Customer Management

Customers can be added manually or via an emailed form (with a secure token link).

Status management (active/inactive), soft deletion, and menu preferences are supported.

Nutrition recommendations are auto-calculated based on input parameters.

Middleware controls customer limits based on the producer’s subscription tier.

Order Management

Once a weekly plan is published, orders are generated based on menu and customer assignments.

Ingredient lists per day are generated for kitchen preparation.

Orders can be marked as completed, and stock is adjusted accordingly.

🔐 Access Control and Middleware
The system uses middleware like checkPlanFeatures() to enforce plan limits (e.g., max number of customers or meals).

Downgrading a subscription plan triggers data archiving and restricts access to certain features.

🔁 Data Flow & Architecture
API endpoints (under /api/v1) are RESTful and use soft-deletion to preserve data consistency.

Most calculations (e.g., calories, nutritional values) are performed dynamically before data is returned to the frontend.

WebSocket events ensure frontend state is always in sync with backend changes.
