# Data Dictionary — QR-Based Table Ordering System

Introspected directly from the running PostgreSQL database (`shaxian_ordering`).
Every type, size, constraint and default below is what the schema actually enforces.

**Fourteen tables.** Table numbering continues the paper's sequence from Table 9.

## Table 9. Tables

Registers every physical table and the unique QR token printed on its marker. Referenced by sessions.

| Field Name | Data Type | Null | Default | Constraint |
|---|---|---|---|---|
| `table_id` | VARCHAR(8) | No | auto (sequence) | PK |
| `table_number` | SMALLINT | No | — | UNIQUE |
| `qr_token` | UUID | No | gen_random_uuid() | — |
| `occupancy_status` | ENUM (vacant / occupied / reserved) | No | 'vacant' | — |
| `is_active` | BOOLEAN | No | true | — |
| `created_at` | TIMESTAMPTZ | No | now() | — |

Check constraints:

- `CHECK (((table_id)::text ~ '^TBL-[0-9]{4}$'::text))`
- `CHECK ((table_number > 0))`

## Table 10. Staff_accounts

Login credentials for the Service Crew and System Administrator roles. Passwords are never stored in plaintext.

| Field Name | Data Type | Null | Default | Constraint |
|---|---|---|---|---|
| `staff_id` | VARCHAR(8) | No | auto (sequence) | PK |
| `username` | VARCHAR(30) | No | — | UNIQUE |
| `password_hash` | CHAR(60) | No | — | — |
| `full_name` | VARCHAR(80) | No | — | — |
| `role` | ENUM (service_crew / admin) | No | — | — |
| `is_active` | BOOLEAN | No | true | — |
| `last_login_at` | TIMESTAMPTZ | Yes | — | — |
| `created_at` | TIMESTAMPTZ | No | now() | — |

Check constraints:

- `CHECK (((staff_id)::text ~ '^STF-[0-9]{4}$'::text))`

## Table 11. Categories

Menu category records and the order their tabs appear in. Referenced by menu_items.

| Field Name | Data Type | Null | Default | Constraint |
|---|---|---|---|---|
| `cat_id` | VARCHAR(8) | No | auto (sequence) | PK |
| `name_en` | VARCHAR(40) | No | — | — |
| `name_fil` | VARCHAR(40) | No | — | — |
| `name_bis` | VARCHAR(40) | No | — | — |
| `display_order` | SMALLINT | No | 0 | — |
| `is_active` | BOOLEAN | No | true | — |

Check constraints:

- `CHECK (((cat_id)::text ~ '^CAT-[0-9]{4}$'::text))`

## Table 12. Menu_items

Every orderable item, with the trilingual names, nutrition and allergen disclosures required by the Menu Information Module.

| Field Name | Data Type | Null | Default | Constraint |
|---|---|---|---|---|
| `item_id` | VARCHAR(8) | No | auto (sequence) | PK |
| `cat_id` | VARCHAR(8) | No | — | FK → categories |
| `name_en` | VARCHAR(60) | No | — | — |
| `name_fil` | VARCHAR(60) | No | — | — |
| `name_bis` | VARCHAR(60) | No | — | — |
| `description_en` | VARCHAR(160) | Yes | — | — |
| `description_fil` | VARCHAR(160) | Yes | — | — |
| `description_bis` | VARCHAR(160) | Yes | — | — |
| `price` | NUMERIC(8,2) | No | — | — |
| `calories` | SMALLINT | Yes | — | — |
| `allergens` | VARCHAR(120) | Yes | — | — |
| `dietary_flags` | VARCHAR(60) | Yes | — | — |
| `image_filename` | VARCHAR(80) | Yes | — | — |
| `is_available` | BOOLEAN | No | true | — |
| `is_featured` | BOOLEAN | No | false | — |
| `created_at` | TIMESTAMPTZ | No | now() | — |

Check constraints:

- `CHECK (((item_id)::text ~ '^MNU-[0-9]{4}$'::text))`
- `CHECK ((calories >= 0))`
- `CHECK ((price >= (0)::numeric))`

## Table 13. Sessions

One ordering interaction from QR scan to checkout. Anchors transactions, devices, analytics and priority declarations. Demographic fields are populated by direct user input, never by a camera.

| Field Name | Data Type | Null | Default | Constraint |
|---|---|---|---|---|
| `session_id` | BIGINT | No | — | PK |
| `table_id` | VARCHAR(8) | No | — | FK → tables |
| `started_at` | TIMESTAMPTZ | No | now() | — |
| `ended_at` | TIMESTAMPTZ | Yes | — | — |
| `declared_priority_status` | ENUM (standard / senior / pwd / pregnant) | No | 'standard' | — |
| `session_type` | ENUM (standard / priority / group) | No | 'standard' | — |
| `group_mode` | BOOLEAN | No | false | — |
| `ui_mode_used` | ENUM (standard / accessible) | No | 'standard' | — |
| `language_used` | ENUM (en / fil / bis) | No | 'en' | — |
| `accessibility_accepted` | BOOLEAN | No | false | — |

## Table 14. Session_devices

Every phone that joins a table session. A Standard or single-device Priority session has one row; a Group session has two or more, enabling split-bill attribution.

| Field Name | Data Type | Null | Default | Constraint |
|---|---|---|---|---|
| `device_id` | BIGINT | No | — | PK |
| `session_id` | BIGINT | No | — | FK → sessions |
| `device_token` | UUID | No | gen_random_uuid() | UNIQUE |
| `joined_at` | TIMESTAMPTZ | No | now() | — |
| `display_name` | VARCHAR(30) | Yes | — | — |
| `is_host` | BOOLEAN | No | false | — |

## Table 15. Transactions

Every placed order with its full tax and discount breakdown. Parent of transaction_items, payments and kitchen_queue, and the source read by the Apriori batch job.

| Field Name | Data Type | Null | Default | Constraint |
|---|---|---|---|---|
| `txn_id` | BIGINT | No | — | PK |
| `session_id` | BIGINT | No | — | FK → sessions |
| `placed_at` | TIMESTAMPTZ | No | now() | — |
| `gross_amount` | NUMERIC(10,2) | No | — | — |
| `vatable_sales` | NUMERIC(10,2) | No | 0 | — |
| `vat_exempt_sales` | NUMERIC(10,2) | No | 0 | — |
| `vat_amount` | NUMERIC(10,2) | No | 0 | — |
| `discount_amount` | NUMERIC(10,2) | No | 0 | — |
| `net_amount` | NUMERIC(10,2) | No | — | — |
| `item_count` | SMALLINT | No | — | — |
| `is_priority` | BOOLEAN | No | false | — |
| `queue_date` | DATE | No | CURRENT_DATE | UNIQUE (queue_date, queue_number) |
| `queue_number` | SMALLINT | No | — | UNIQUE (queue_date, queue_number) |
| `status` | ENUM (pending / preparing / ready / completed / abandoned / voided) | No | 'pending' | — |
| `voided_by` | VARCHAR(8) | Yes | — | FK → staff_accounts |
| `void_reason` | VARCHAR(120) | Yes | — | — |
| `voided_at` | TIMESTAMPTZ | Yes | — | — |

Check constraints:

- `CHECK ((gross_amount >= (0)::numeric))`
- `CHECK ((item_count > 0))`
- `CHECK ((net_amount >= (0)::numeric))`
- `CHECK ((queue_number > 0))`

## Table 16. Transaction_items

Line items per transaction. The direct source of the market baskets used in Apriori computation.

| Field Name | Data Type | Null | Default | Constraint |
|---|---|---|---|---|
| `txi_id` | BIGINT | No | — | PK |
| `txn_id` | BIGINT | No | — | FK → transactions |
| `item_id` | VARCHAR(8) | No | — | FK → menu_items |
| `device_id` | BIGINT | Yes | — | FK → session_devices |
| `quantity` | SMALLINT | No | — | — |
| `unit_price` | NUMERIC(8,2) | No | — | — |
| `subtotal` | NUMERIC(10,2) | No | — | — |
| `is_discounted` | BOOLEAN | No | false | — |
| `discount_amount` | NUMERIC(8,2) | No | 0 | — |

Check constraints:

- `CHECK ((quantity > 0))`
- `CHECK ((subtotal >= (0)::numeric))`
- `CHECK ((unit_price >= (0)::numeric))`

## Table 17. Kitchen_queue

Operationalises the fairness-bounded priority queue: live position plus the count of Standard orders a Priority order has advanced ahead of.

| Field Name | Data Type | Null | Default | Constraint |
|---|---|---|---|---|
| `queue_id` | BIGINT | No | — | PK |
| `txn_id` | BIGINT | No | — | FK → transactions, UNIQUE |
| `queue_position` | SMALLINT | No | — | — |
| `priority_skips_used` | SMALLINT | No | 0 | — |
| `updated_by` | VARCHAR(8) | Yes | — | FK → staff_accounts |
| `entered_queue_at` | TIMESTAMPTZ | No | now() | — |
| `prep_started_at` | TIMESTAMPTZ | Yes | — | — |
| `completed_at` | TIMESTAMPTZ | Yes | — | — |

Check constraints:

- `CHECK ((priority_skips_used >= 0))`
- `CHECK ((queue_position > 0))`

## Table 18. Payments

One or more payment records per transaction, supporting both single-payer orders and split Group sessions.

| Field Name | Data Type | Null | Default | Constraint |
|---|---|---|---|---|
| `payment_id` | BIGINT | No | — | PK |
| `txn_id` | BIGINT | No | — | FK → transactions |
| `device_id` | BIGINT | Yes | — | FK → session_devices |
| `method` | ENUM (online / cashier) | No | — | — |
| `amount` | NUMERIC(10,2) | No | — | — |
| `discount_applied` | NUMERIC(10,2) | No | 0 | — |
| `aggregator_ref` | VARCHAR(50) | Yes | — | — |
| `status` | ENUM (pending / paid / failed) | No | 'pending' | — |
| `print_status` | ENUM (success / failed) | Yes | — | — |
| `paid_at` | TIMESTAMPTZ | Yes | — | — |

Check constraints:

- `CHECK ((amount > (0)::numeric))`

## Table 19. Apriori_rules

Association rules produced by the Apriori batch job, segmented by session_type and read at recommendation time.

| Field Name | Data Type | Null | Default | Constraint |
|---|---|---|---|---|
| `rule_id` | VARCHAR(8) | No | auto (sequence) | PK |
| `session_type` | ENUM (standard / priority / group) | No | — | — |
| `antecedents` | JSONB | No | — | — |
| `consequents` | JSONB | No | — | — |
| `support` | NUMERIC(6,4) | No | — | — |
| `confidence` | NUMERIC(6,4) | No | — | — |
| `lift` | NUMERIC(6,4) | No | — | — |
| `generated_at` | TIMESTAMPTZ | No | now() | — |

Check constraints:

- `CHECK (((confidence >= (0)::numeric) AND (confidence <= (1)::numeric)))`
- `CHECK (((rule_id)::text ~ '^APR-[0-9]{4}$'::text))`
- `CHECK (((support >= (0)::numeric) AND (support <= (1)::numeric)))`
- `CHECK ((lift > (0)::numeric))`

## Table 20. Analytics_events

Every interaction event from the React client. Primary source for the confusion-trigger and recommendation-acceptance rates.

| Field Name | Data Type | Null | Default | Constraint |
|---|---|---|---|---|
| `event_id` | BIGINT | No | — | PK |
| `session_id` | BIGINT | No | — | FK → sessions |
| `event_type` | ENUM (dwell_timeout / back_navigation / cart_abandon / scroll_reversal / recommendation_shown / recommendation_accepted / recommendation_dismissed) | No | — | — |
| `screen_id` | VARCHAR(40) | Yes | — | — |
| `occurred_at` | TIMESTAMPTZ | No | now() | — |
| `metadata` | JSONB | Yes | — | — |

## Table 21. Priority_verification_log

Audit trail of every priority declaration. Stores only the last four digits of a presented ID; contains no image or biometric data.

| Field Name | Data Type | Null | Default | Constraint |
|---|---|---|---|---|
| `log_id` | BIGINT | No | — | PK |
| `session_id` | BIGINT | No | — | FK → sessions |
| `declared_status` | ENUM (standard / senior / pwd / pregnant) | No | — | — |
| `id_presented` | BOOLEAN | No | false | — |
| `id_last4` | CHAR(4) | Yes | — | — |
| `cardholder_name` | VARCHAR(80) | Yes | — | — |
| `issuing_lgu` | VARCHAR(50) | Yes | — | — |
| `verified_by` | VARCHAR(8) | Yes | — | FK → staff_accounts |
| `verified_at` | TIMESTAMPTZ | Yes | — | — |
| `discount_eligible` | BOOLEAN | No | false | — |

Check constraints:

- `CHECK ((declared_status <> 'standard'::priority_status_enum))`
- `CHECK ((id_last4 ~ '^[0-9]{4}$'::text))`

## Table 22. Audit_log

System action trail — staff record changes and outbound POS transmissions, with before/after state captured as JSON.

| Field Name | Data Type | Null | Default | Constraint |
|---|---|---|---|---|
| `audit_id` | BIGINT | No | — | PK |
| `staff_id` | VARCHAR(8) | Yes | — | FK → staff_accounts |
| `action` | VARCHAR(40) | No | — | — |
| `entity_type` | VARCHAR(40) | No | — | — |
| `entity_id` | VARCHAR(20) | Yes | — | — |
| `before_state` | JSONB | Yes | — | — |
| `after_state` | JSONB | Yes | — | — |
| `ip_address` | INET | Yes | — | — |
| `occurred_at` | TIMESTAMPTZ | No | now() | — |

## Enum types

All status columns are PostgreSQL enum types, not free-text VARCHAR.

| Type | Values |
|---|---|
| `event_type_enum` | dwell_timeout / back_navigation / cart_abandon / scroll_reversal / recommendation_shown / recommendation_accepted / recommendation_dismissed |
| `language_enum` | en / fil / bis |
| `occupancy_status_enum` | vacant / occupied / reserved |
| `payment_method_enum` | online / cashier |
| `payment_status_enum` | pending / paid / failed |
| `print_status_enum` | success / failed |
| `priority_status_enum` | standard / senior / pwd / pregnant |
| `session_type_enum` | standard / priority / group |
| `staff_role_enum` | service_crew / admin |
| `txn_status_enum` | pending / preparing / ready / completed / abandoned / voided |
| `ui_mode_enum` | standard / accessible |

## Key generation

Prefixed identifiers are issued by PostgreSQL sequences through `key_default()` in
`app/models/keys.py` and validated by check constraints:
`TBL-NNNN`, `STF-NNNN`, `CAT-NNNN`, `MNU-NNNN`, `APR-NNNN`.
