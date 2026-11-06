**UI/UX Standards**  
**Ticket: S1-002**  
ReviewLens uses a simple and minimal design that shares the same style as modern AI models like Claude, ChatGPT or Gemini. It includes a sidebar, generous white space, one accent color, and content in the center column. This standard makes it easier for any number of developers building different pages of the app to be consistent.   
\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

1. **Application Navigation**:  
   The app has one navigation pattern: a persistent left sidebar. No top bar or any second menu, other than the login page.  
   1. UX-01: Sidebar (Listed as what it should look like from top to bottom)  
      1. ReviewLens logo (Could link it to home or a new query/product)  
      2. New product button (Goes straight to a new query/product)  
      3. “Products” label and the user’s products with the most recent query first, one line each and truncated with “...”. The active product is also highlighted  
      4. User menu pinned to the bottom like an avatar/initial and/or display name. This opens the user’s profile, about and log out button.  
   2. UX-02: Inside a product  
      1. The workspace header shows three text tabs: Overview, reviews and ask. Tabs are part of the URL so the refresh and back button should work  
   3. UX-03: Routes  
      1. 

| Route | Screen | Access |
| :---- | :---- | :---- |
| /login, /register, /forgot-password | Authentication screens (no sidebar) | Public |
| / | Home | Signed in |
| /products/:id/overview, /reviews, /ask | Product workspace | Signed in |
| /profile | Profile | Signed in |
| /about | About | Signed in |

   4. UX-04:  
      1. Signed-out users opening a protected route (“signed-in” access), they should be sent to /login and returned to the page they wanted to access after signing in.  
   5. UX-05:  
      1. The sidebar collapses into a drawer opened by a menu button in the top-left alongside the logo.  
2. **Page Layout**

	\+--------------+------------------------------------------+  
\| Logo         \|  Product name     Overview  Reviews  Ask \|  
\| \+ New product\|------------------------------------------\|  
\|              \|                                          \|  
\| Product A    \|         centered content column          \|  
\| Product B    \|            			             \|  
\| Product C    \|                                          \|  
\|              \|                                          \|  
\| \------------ \|   \+----------------------------------+   \|  
\| User menu    \|   \| Ask about these reviews...    \>  \|   \|  
\+--------------+---+----------------------------------+---+  
	

1. UX-06:  
   1. Main content sits in the centered content column. Dimensions can be whatever the UI/UX developer believes is appropriate and user-friendly.  
2. UX-07:  
   1. Every signed-in page has the same structure: page header, then content. Page actions sit at the right end of the header  
3. UX-08: Home  
   1. It essentially mirrors or is similar to an AI-assistant start screen. Vertically centered heading that says, “What product do you want to analyze?” or something along those lines. It also contains one large input for an Amazon URL, or ASIN and a short list of recent products below.  
4. UX-09: Product Workspace  
   1. Header with a product name (if the developer wants to include a small product image as well, that’s welcomed), the three tabs, then tab content  
      1. Overview: Stat cards like review count, average rating, % verified, star-distribution chars, last import status. Should also include an import reviews action.  
      2. Reviews: Can filter rows with ratings and verification status above a review list. Each review shows stars, title, date and a verified badge and text.  
      3. Ask: A chat screen that mirrors AI assistants. A text box in the bottom of the column and when the user submits their query, their messages are right aligned in a bubble in plain text while the AI answers are in a left-aligned plain text with no bubble.  
5. UX-10: Authentication Screens  
   1. Uses a centered card on a plain background with the logo above it. No sidebar is present here.  
3. **Form Conventions**  
   1. UX-11:  
      1. One column. Label above each field. Don’t use the placeholder ass the label  
   2. UX-12:   
      1. Placeholders show an example only: [https\://www\.amazon.com/dp/B0…](https://www.amazon.com/dp/B0…)  
   3. UX-13:  
      1. Mark optional fields with “(optional)”; required is the default  
   4. UX-14:  
      1. The submit button sits at the bottom, left-aligned with the fields, labeled with the actions: “Sign in”, “Add product”. Never “Submit”.  
   5. UX-15:  
      1. Enter submits single-field forms. In the chat input, Enter sends and Shift+Enter adds a new line.  
   6. UX-16:  
      1. Focus the first field when a form opens. Keep the user’s input after a failed submit  
   7. UX-17:  
      1. Use the matching input type for email, password and url so browsers and password managers help.  
4. **Validation and Error Presentation**  
   1. Error Levels

| Level | When | Presentation |
| :---- | :---- | :---- |
| Field  | One input is invalid | Red border and message directly under the field in “--danger” |
| Form | Submit failed for a reason not tied to one field (Like a wrong password or server error) | Alert box above the submit button: danger icon and message |
| Page | Data for the page could not load | Centered message in the content area and try again button |
| Background Action | An action not on a form failed (Like delete or import) | Error toast on the bottom right and stays until dismissed |

   2. UX-18:  
      1. Validate a field when it loses focus and again on submit. Don’t show errors while the user is typing for the first time. Clear a field’s error as soon as it becomes valid.  
   3. UX-19  
      1. The frontend checks obvious problems (Like an empty field, wrong format or its too long). The backend validates everything again. Its details array maps onto field errors by field name.  
   4. UX-20  
      1. Messages will say what is wrong and how to fix it, in plain language: “That doesn’t look like an Amazon product link. Past a URL containing /dp/ or a 10-character ASIN.” Never show error codes, stack traces, or “Something went wrong” alone.  
   5. UX-21  
      1. On submit with errors, move focus to the first invalid field.  
   6. UX-22  
      1. Out-of-scope chat questions are not errors: the answer shows a small “--warning” label “Outside these reviews” above it.  
5. **Loading and Processing States**  
   1. UX-23: Initial Load  
      1. Skeleton placeholders shaped like the final content (cards, list rows). No full page spinners  
   2. UX-24: Button Actions  
      1. The clicked button shows a small spinner, keeps its width, and is disabled until the request finishes, preventing double submits. Other fields in the form are disabled too.  
   3. UX-25: Review import (long-running)  
      1. The overview tab shows an inline status row that displays a spinner and text that says “Importing reviews from Amazon…”. On finish it becomes “Imported \[Insert number of reviews here\] reviews just now” (--success) or the error message “Try Again” (--danger). The user can freely switch tabs during the runtime.  
   4. UX-26: AI Answers  
      1. A “Thinking…” indicator (with three animated dots if you’d like) appears where the answer will go and the input is disabled until the answer arrives.  
   5. UX-27: Empty States  
      1. Centered, short message and one action like “No products yet” and Add product. On the other hand, “No reviews imported” and Import reviews  
   6. UX-28:  
      1. The ask input is disabled with the hint, “Import reviews to start asking questions” until the product has reviews.  
   7. UX-29: Success feedback  
      1. A brief toast for completed actions such as “Product added” or “Product deleted”. No toast for navigation or saving a single field inline.  
6. **Button and Action Conventions**  
   1. 

| Variant | Look | Use |
| :---- | :---- | :---- |
| Primary | –accent fill, white text | The single main action on a screen |
| Secondary | 1px –border outline, –text | Alternative actions (Like cancel or filter) |
| Ghost | Text only, –bg-subtle on hover | Sidebar items, toolbar and icon actions |
| Destructive | –danger fill | Delete, only inside a confirmation dialogue |

   2. UX-30:  
      1. At most, one primary button visible per screen or dialog.  
   3. UX-31:  
      1. Labels are short verbs in sentence case: “Add product”, “Import reviews”, “Delete product”. No “OK”, “Submit”, or “Click here”.  
   4. UX-32:  
      1. Button order in dialogs and forms: secondary on the left and primary on the right  
   5. UX-33:  
      1. Destructive actions always open a confirmation box naming the item. For example: “Delete *Echo Dot (5th Gen*)? Its reviews and analysis will be removed.” with Cancel and Delete.  
   6. UX-34:  
      1. Sizes: Default is 40px tall, small 32px (tables, toolbars). Minimum touch target 40x40px.  
   7. UX-35:  
      1. Icon-only buttons use Lucide icons, have a tooltip, and an “aria-label”  
   8. UX-36:  
      1. Links for navigation look like links; buttons for actions look like buttons. Do not swap them.  
7. **Spacing and Typography**  
   1. Typography  
      1. UX-37:  
         1. Font: **Geist**, falling back to the system font stack. Sizes will vary:  
            1. 

| Use | Size / weight / line height |
| :---- | :---- |
| Page Title | 24px / 600 / 1.3 |
| Section Heading | 18px / 600 / 1.4 |
| Body and Chat Text | 16px / 400 / 1.6 |
| Labels, Table Text, Metadata | 14px / 400-500 / 1.5 |
| Captions, Timestamps | 12px / 400 / 1.4 |

      2. UX-38:  
         1. Sentence case for all titles, labels, and buttons. No all-caps text, no underlines except links on hover.  
   2. Spacing and Shape  
      1. UX-39:  
         1. Spacing uses a 4px scale only: 4, 8, 12, 16, 24, 32, 48 (Tailwind 1, 2, 3, 4, 6, 8, 12).  
            1. 8px between a label and its field; 16px between form fields; 24px between sections; 48px above a page’s main heading on Home.  
      2. UX-40: Corner radius   
         1. 8px for buttons, inputs, and cards; 16px for dialogs; 24px for the chat input; full circles for avatars.  
      3. UX-41:  
         1. Cards use a 1px –border, no shadow. Shadows are only on floating elements like dialogs, dropdowns, toasts, and chat input.  
   3. Color Tokens  
      1. 

| Token | Value | Use |
| :---: | :---: | :---- |
| –bg | \#FFFFFF | Main background |
| –bg-subtle | \#F7F7F8 | Sidebar, user chat bubbles, hover |
| –border | \#E5E5E5 | Borders, dividers |
| –text | \#1F1F1F | Body Text |
| –text-muted | \#6B6B6B | Secondary Text |
| –accent | \#4F46E5 | Primary buttons, links. Focus rings. Active item |
| –success | \#16A34A | Successful import |
| –warning | \#D97706 | Out-of-scope notice |
| –danger | \#DC2626 | Errors, destructive actions |

8. **Reusable Component Expectations**  
   1. UX-42:  
      1. Shared components live in “frontend/src/components/ui/” and are built on shadcn/ui, styled only with the tokens above. Feature-specific components stay in their feature folder.  
   2. UX-43:  
      1. Before building something new, use an existing component. Create a new shared component when the same UI appears in two or more places.  
   3. UX-44: Required shared components (Build once, use everywhere):  
      1. 

| Component | Used for |
| :---- | :---- |
| Button | All four variants, with loading prop (UX-24) |
| Input, Textarea, FormField | Label \+ input \+ error message as one unit |
| Card, StatCard | Overview metrics and grouped content |
| Tabs | Product workspace tabs |
| Dialog, ConfirmDialog | Modals and destructive confirmation |
| Toast | Success and background-error messages |
| Skeleton | Loading placeholders |
| EmptyState | Icon \+ message \+ one action |
| ErrorState | Page-level error \+ Try again |
| StarRating | Displaying 1-5 ratings |
| PageHeader | Title, description, actions |
| ChatMessage, ChatInput | Ask tab |

   4. UX-45:  
      1. Components accept props for content and variants; they never fetch data themselves.  
   5. UX-46:  
      1. Every interactive component is keyboard accessible with a visible focus ring (--accent).  
   6. UX-47:  
      1. Never display placeholder or sample reviews as if they were real imported data.

	