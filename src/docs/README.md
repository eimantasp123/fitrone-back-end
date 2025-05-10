### **General Documentation - System Flow**

# **Main Dependencies**

This document explains the system flows, dependencies, and all operations occurring within the internal controller modules.

---

## **1. Main System Components**

- **Ingredients** | The system flow begins with the creation and management of ingredients.
- **Meals** | The next flow involves creating main meals from ingredients.
- **Weekly Menus** | Weekly menus are created from the list of meals, tailored to the producer's needs.
- **Weekly Plan** | An active weekly controller used to attach the appropriate weekly menu to the active weekly plan. Customers are also assigned to the plan.
- **Customers** | Customers can be added to the system either manually by the producer or through an electronic form sent to the customer's email, which they must fill out.
- **Order Management and Components** | A section where producers can view and monitor all orders for a specific day, generate ingredient lists, mark order completion, and more.

**--! Important Aspects !--**

## **Updates**

Most system calculations are performed before sending data to the client. Certain calculations are not stored in documents. The main component recalculated when ingredients are updated is the **meal**. The rest of the system calculates data before retrieval and does not store the total calorie count in documents to simplify backend operations and reduce dependencies.

## **Middleware**

The middleware `checkPlanFeatures()` verifies whether the producer has reached their plan limit when adding ingredients, meals, weekly menus, weekly plans, and customers.

## **Plan Downgrade**

When downgrading a subscription plan from a higher tier to a lower tier, certain data is archived. Producers are informed about the archiving process, but in the first MVP stage, access to archived data is limited.

- Archived **ingredients** and **meals** cannot be viewed.
- Only archived **weekly menus** can be viewed.

---

## **2. Detailed System Flow Description** (API version `/api/v1`)

### **2.1 Ingredients**

#### Request Methods:

- **POST** | `/ingredients` (documentation link: `URL`)  
  The producer can create an ingredient manually or use an AI tool to add an ingredient during meal creation. The producer cannot add ingredients with identical names.

- **GET** | `/ingredients` (documentation link: `URL`)  
  The producer retrieves all ingredients that are not deleted or removed from the system **deletedAt: null**. Ingredients can also be searched using a specific query input.

- **PUT** | `/ingredients/:ingredientId` (documentation link: `URL`)  
  The producer can update an ingredient and modify certain data. When updating ingredients, backend operations are triggered since ingredients are one of the main system components that significantly impact data updates. After a successful update, data refresh must be initiated on the frontend.  
  **GET** : `/ingredients`

  **-- Backend Operations --**:

  - When updating an ingredient, backend operations are triggered. Nutritional values of all meals using the ingredient are recalculated.
  - After a successful update, a **WebSocket** message `ingredient_updated_in_meals` is sent, notifying that the operation was successful, and data can be refreshed on the client side:  
    **GET** : `/meals`

- **DELETE** | `/ingredients/:ingredientId` (documentation link: `URL`)  
  The producer can also remove ingredients from the system using the **Soft delete** principle. After a successful deletion, data refresh must be initiated on the frontend.  
  **GET** : `/ingredients`

##### **Additional Request Operations**:

- **GET** | `/ingredients/search` (documentation link: `URL`)  
  The producer can search for specific ingredients directly while creating a meal.

- **POST** | `/ingredients/search-ai` (documentation link: `URL`)  
  The producer can search for ingredients using the OpenAI API by submitting a query with the ingredient name and other required data.

- **GET** | `/ingredients/nutrition/:ingredientId` (documentation link: `URL`)  
  The producer can retrieve calculated nutritional values of an ingredient based on the specified quantity.

### **2.2 Meals**

#### Dependencies:

- Ingredients

#### Request Methods:

- **POST** | `/meals` (documentation link: `URL`)  
  The producer can create a meal manually. They can add a photo and ingredients from their ingredient list. If the producer does not have the required ingredients, they can add them during meal creation or search for ingredients using the `OpenAI API`. The producer can only create one meal with the same name. The photo must also meet the requirements specified in the API documentation.

- **GET** | `/meals` (documentation link: `URL`)  
  The producer retrieves all their created meals that are not deleted or removed from the system **deletedAt: null**. Meals can also be searched using various filters or a specific query.

- **PUT** | `/meals/:id` (documentation link: `URL`)  
  The producer can update their meals and modify certain data. After a successful update, data refresh must be initiated on the frontend:  
  **GET** : `/meals`

- **DELETE** | `/meals/:id` (documentation link: `URL`)  
  The producer can also remove meals from the system using the **Soft delete** principle. After a successful deletion, data refresh must be initiated on the client side:  
  **GET** : `/meals`

### **2.3 Weekly Menus**

#### Dependencies:

- Weekly Plan

#### Request Methods:

- **POST** | `/weekly-menu` (documentation link: `URL`)  
  The producer can create a weekly menu, adding various meals to specific days from their created meal list. The weekly menu name must be unique and cannot be duplicated. A producer can only have one weekly menu with the same name.

- **GET** | `/weekly-menu` (documentation link: `URL`)  
  The producer retrieves all weekly menus that are not deleted or removed from the system **deletedAt: null**. Weekly menus can also be searched using a query or selected filters. Only the weekly menu name, description, and dietary restrictions are retrieved.

- **PATCH** | `/weekly-menu/:id` (documentation link: `URL`)  
  The producer can update a weekly menu and modify certain data. During the update, only the name, description, and dietary preferences can be changed. After a successful update, data refresh must be initiated on the frontend:  
  **GET** : `/weekly-menu`  
  **GET** : `/weekly-menu/:id`  
  **GET** : `/weekly-plan`  
  **GET** : `/orders`

- **DELETE** | `/weekly-menu/:id` (documentation link: `URL`)  
  The producer can remove a weekly menu from the system using the **Soft delete** principle. A weekly menu cannot be deleted if it is assigned to an `active weekly plan`. After a successful deletion, data refresh must be initiated on the frontend:  
  **GET** : `/weekly-menu`

- **PATCH** | `/weekly-menu/archive/:id` (documentation link: `URL`)  
  The producer can archive unused weekly menus to free up the limit and add more weekly plans. Only `WEEKLY MENUS` that are not active can be archived. After a successful archiving, data refresh must be initiated on the frontend:  
  **GET** : `/weekly-menu`

- **PATCH** | `/weekly-menu/unarchive/:id` (documentation link: `URL`)  
  The producer can unarchive a weekly menu if it needs to be reused. Before unarchiving, the producer's weekly menu limit is checked using the `checkPlanFeatures` middleware. After a successful unarchiving, data refresh must be initiated on the frontend:  
  **GET** : `/weekly-menu`

- **GET** | `/weekly-menu/:id` (documentation link: `URL`)  
  The producer retrieves the data of a specific weekly menu that is not deleted or removed from the system **deletedAt: null**. The producer retrieves all weekly data, including all days of the week and the meals assigned to them. Daily calorie norms and nutritional values are calculated on the client side.

- **POST** | `/weekly-menu/:id/meal` (documentation link: `URL`)  
  The producer can add a meal to a specific day of the week if the weekly menu is not active in the system. If the weekly menu is already active, this action cannot be performed. The meal is added to the weekly menu as a copy, so changes to ingredients or meals do not affect the created weekly menu. If the producer wants to update specific meal information, they must reassign the meal to the corresponding weekly menu.

- **DELETE** | `/weekly-menu/:id/meal` (documentation link: `URL`)  
  The producer can remove a meal from a specific day of the week if the weekly menu is not active in the system. If the weekly menu is active, this action cannot be performed.

### **2.4 Weekly Plan**

#### Dependencies:

- Weekly Menu
- Customers

#### Request Methods:

- **PATCH** | `/weekly-plan/set-timezone` (documentation link: `URL`)  
  The producer can set or change their timezone (UTC) based on location. The main weekly menu will be displayed according to the selected UTC timezone. Before creating any weekly plan, the producer must set their timezone.

- **GET** | `/weekly-plan` (documentation link: `URL`)  
  The producer retrieves the exact weekly plan, which is automatically created when the user navigates between weeks on the client side. The main plan template is created automatically and does not require additional actions. If the producer has not yet set their timezone, the plan is not generated automatically, and the request is ignored. The request sends weekly data to the client based on the year and week number if validation is successful.

- **PATCH** | `/weekly-plan/:id/assign-menu` (documentation link: `URL`)  
  The producer can assign their created weekly menu to the corresponding weekly plan, which was created automatically. Before adding each `WEEKLY MENU`, plan limits are calculated using the `checkWeeklyPlanMenu` middleware. Only one identical weekly menu can be added to each weekly plan. The same menu cannot be added to the same week. When assigning a menu, active weekly data is also linked to the menu to monitor its activity. The assigned `WEEKLY MENU` becomes `active` and can no longer be modified. After a successful assignment, data refresh must be initiated on the frontend:  
  **GET** : `/weekly-plan`  
  **GET** : `/weekly-menu`  
  **GET** : `/weekly-menu/:id`

- **DELETE** | `/weekly-menu/delete-menu` (documentation link: `URL`)  
  The producer can remove an assigned `WEEKLY MENU` from the weekly plan if it is not published. Weekly plan data linked during menu assignment is also removed. If the removed `WEEKLY MENU` no longer has assigned weekly plans, it becomes `inactive` and can be modified. After a successful removal, data refresh must be initiated on the frontend:  
  **GET** : `/weekly-plan`  
  **GET** : `/weekly-menu`  
  **GET** : `/weekly-menu/:id`

- **PATCH** | `/weekly-plan/:id/assign-customers` (documentation link: `URL`)  
  The producer can assign customers to the weekly menu if it is not yet published. If the producer's customer menu quantity is 1 (default), they can only be assigned to one weekly menu plan to avoid duplication. If the producer's customer has more than 1 menu selection, they can be assigned to multiple weekly menus within one week (e.g., for family menu options). After a successful assignment, data refresh must be initiated on the frontend:  
  **GET** : `/weekly-plan/:id/menu-details/:menuId`

- **PATCH** | `/weekly-plan/:id/remove-customer` (documentation link: `URL`)  
  The producer can remove a customer from the weekly plan menu if it is not yet published. After a successful removal, data refresh must be initiated on the frontend:  
  **GET** : `/weekly-plan/:id/menu-details/:menuId`

- **PATCH** | `/weekly-plan/manage-publish-menu` (documentation link: `URL`)  
  The producer, after adding weekly menus and assigning customers to each weekly menu, must publish the menu to form orders and perform calculations. This request works on a `Toggle` principle – if the menu is already published, it will be unpublished and vice versa. After a successful publish/unpublish, data refresh must be initiated on the frontend:  
  **GET** : `/weekly-plan`  
  **GET** : `/orders`

`PUBLISH`: Before allowing the menu to be published, it must be checked whether orders for the current week have already been created. If orders are created, it must be checked whether at least one day is already completed from the formed orders related to the newly published menu. If at least one day from the published menu is completed in the created orders, the menu cannot be published.

`UNPUBLISH`: Before unpublishing, it must be checked whether at least one day of the menu to be unpublished is completed. If completed, it cannot be unpublished. If not, it can be unpublished. Additionally, when unpublishing the menu, all active ingredients and their stock are checked. Ingredient stocks not in active orders are removed from the system.

- **GET** | `/weekly-plan/:id/menu-details/:menuId` (documentation link: `URL`)  
  The producer can retrieve the list of assigned customers for each weekly menu plan. For example, if it is the 7th week of 2025 and 4 weekly menus are assigned, the producer can retrieve the customer list for each assigned menu and verify whether the assignments match the updated data.

The producer can independently complete the weekly plan, in which case the entire weekly plan will be finalized, and no further changes can be made.

### **2.5 Customers**

#### Dependencies:

- Weekly Plan Menu Details

#### Request Methods:

- **POST** | `/customers` (documentation link: `URL`)  
  The producer can add their customers to the system to facilitate and streamline order management. Using this method, the producer can manually add a customer by filling out all the required information. Before adding each customer, the producer's `checkPlanFeatures` limit is verified. After a successful addition, data refresh must be initiated on the frontend:  
  **GET** : `/customers`

- **POST** | `/customers/send-form` (documentation link: `URL`)  
  Producers with `PRO` and `PREMIUM` plans can send a form request directly to their customers via email, allowing them to fill out their information independently. After successfully sending the form, data refresh must be initiated on the frontend:  
  **GET** : `/customers`

- **POST** | `/customers/resend-form` (documentation link: `URL`)  
  The producer can resend the form to the customer if they did not receive the previous form due to unknown reasons or if the form token's validity (36h) has expired. When resending the form, no data refresh is required on the frontend.

- **POST** | `/customers/confirm-form/:token` (documentation link: `URL`)  
  The customer fills out and submits the form to the server for confirmation. Once the form is successfully confirmed and the customer's data is updated, a **WebSocket** message `customer_form_confirmed` is sent to the producer, notifying them of the successful operation. After confirmation, data refresh must be initiated on the frontend:  
  **GET** : `/customers`

- **DELETE** | `/customers/:id` (documentation link: `URL`)  
  The producer can remove customers from the system using the **Soft delete** principle, allowing access to previous orders and other related information. If the customer is assigned to an active `WEEKLY PLAN`, they cannot be removed. After successful removal, data refresh must be initiated on the frontend:  
  **GET** : `/customers`

- **PUT** | `/customers/:id` (documentation link: `URL`)  
  The producer can update customer data at any time. After a successful update, data refresh must be initiated on the frontend:  
  **GET** : `/customers`  
  **GET** : `/orders` (coming soon)

- **GET** | `/customers` (documentation link: `URL`)  
  The producer retrieves all their customers who are not deleted or removed from the system **deletedAt: null**. Customers can also be searched using a query input and selected filters.

- **PATCH** | `/customers/:id/change-status/inactive` (documentation link: `URL`)  
  The producer can change a customer's status to `inactive`, temporarily removing them from the active customer list. This allows adding more customers if the limit has been reached. A customer can only be made inactive if they are not assigned to any active `WEEKLY PLAN`. After a successful update, data refresh must be initiated on the frontend:  
  **GET** : `/customers`

- **PATCH** | `/customers/:id/change-status/active` (documentation link: `URL`)  
  The producer can change a customer's status to `active`, allowing them to be assigned to a `WEEKLY PLAN`. When activating a customer, the active and pending customer limits are checked using the `checkPlanFeatures` middleware. If the limit is exceeded, the customer cannot be activated. After a successful activation, data refresh must be initiated on the frontend:  
  **GET** : `/customers`

- **PATCH** | `/customers/:id/change-menu-quantity` (documentation link: `URL`)  
  The producer can change the customer's menu selection quantity (default – 1). After a successful update, data refresh must be initiated on the frontend:  
  **GET** : `/customers`

- **POST** | `/customers/:id/calculate-nutrition` (documentation link: `URL`)  
  The producer can use the recommended customer nutrition calculation. The system automatically calculates the required nutrient amounts based on specific customer parameters. After successful calculation, the calculated data is provided during submission, allowing it to be added to the customer's overall data on the client side.
