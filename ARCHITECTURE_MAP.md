# ARCHITECTURE MAP

## Component Hierarchy (Top to Bottom Dependency)

HTTP SERVER (Node.js Request/Response Listener)
↓
ROUTER (Path Matching)
↓
MIDDLEWARE / AUTHORIZATION (Security Context)
↓
HANDLERS (HTTP Controllers / API Boundary)
↓
SERVICES (Business Logic Layer)
↓
REPOSITORIES (Data Access Layer)
↓
SUPABASE (PostgREST / Auth / RPC)
↓
DATABASE (PostgreSQL)

## Testing Architecture
TESTS
↓
API / REPOSITORIES / SERVICES
↓
LOCAL SUPABASE DOCKER INSTANCE

## Checkout Architecture
Checkout transitions (moving items from Cart to Checkout and reserving inventory) are heavily pushed down into the DATABASE layer via RPCs (`create_checkout`). The SERVICES layer orchestrates the RPC calls, ensuring atomic safety and avoiding mid-flight application crashes causing corrupted states.
