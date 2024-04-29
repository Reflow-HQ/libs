export interface User {
  object: "user";
  id: number;
  name: string;
  email: string;
  photo: string;
  provider: string;
  meta: Record<string, any>;
  created: number;
  livemode?: boolean;
}

export interface AuthRefreshChange {
  signout: boolean;
  user: boolean;
  subscription: boolean;
}

export interface CurrencyCode {
  code: string;
  name: string;
  zero_decimal: boolean;
}

export interface Plan {
  object: "plan";
  id: number;
  name: string;
  description: string;
  parameters: Record<string, any>;
  trial_days: number;
  subscription_setup_fee: null | {
    name: string;
    description: string;
    price: number;
    price_formatted: string;
    currency: CurrencyCode;
  };
  is_archived: boolean;
  created: number;
}

export interface Price {
  object: "plan_price";
  id: number;
  price: number;
  price_formatted: string;
  currency: CurrencyCode;
  billing_period: string;
  is_taxed: boolean;
  tax_behavior: string;
  is_archived: boolean;
  created: number;
}

export interface Subscription {
  object: "subscription";
  id: number;
  status: string;
  last_billing: null | number;
  next_billing: null | number;
  cancel_at: null | number;
  plan: Plan;
  price: Price;
  payment_provider: string;
  livemode: boolean;
}

export interface UpdateUserOptions {
  name?: string;
  email?: string;
  photo?: Blob;
  meta?: Record<string, any>;
}

interface ReflowAuthOptions {
  secret: string;
  cookieName?: string;
  cookieMaxAge?: number;
  apiBase?: string;
  testMode?: boolean;
  beforeSignin?: (user: User) => Promise<boolean | undefined>;
}
export type ReflowAuthConfig =
  | (ReflowAuthOptions & { projectID: number; storeID?: never })
  | (ReflowAuthOptions & { storeID: number; projectID?: never });
