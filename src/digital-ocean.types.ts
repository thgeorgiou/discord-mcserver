/**
 * Used to create Droplets
 * @see CreateDropletResponseDto
 */
export interface CreateDropletDto {
  /** Name of droplet */
  name: string;

  /** Slug for region to deploy in */
  region: string;

  /** Slug for size */
  size: string;

  /** Slug for distribution image to use */
  image: string;

  /** Which SSH keys to add from the acccount */
  ssh_keys: string[];

  /** Automatic backups */
  backups?: boolean;

  /** Enable DO monitoring */
  monitoring?: boolean;

  /** Which volumes to attach */
  volumes?: string[];
}

/**
 * Contains information about one network of the droplet
 * @see Droplet
 */
export interface DropletNetwork {
  ip_address: string;
  netmask: string;
  gateway: string;
  type: "public" | string;
}

/**
 * Contains information about a currently created droplet.
 */
export interface Droplet {
  id: number;
  name: string;
  status: "new" | "active" | "off" | "archive";
  networks: { v4?: DropletNetwork; v6?: DropletNetwork };
}

/**
 * Response when creating droplets.
 * @see Droplet
 * @see CreateDropletDto
 */
export interface CreateDropletResponseDto {
  droplet: Droplet;
}

/**
 * Response when fetching a current droplet
 * @see Droplet
 */
export interface GetDropletResponseDto {
  droplet: Droplet;
}

/**
 * Response when getting account balance.
 */
export interface GetAccountBalance {
  month_to_date_balance: string;
  account_balance: string;
  month_to_date_usage: string;
  generated_at: string;
}
