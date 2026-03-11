export interface Agent {
    id: string;
    name: string;
    description: string;
    skill: string;
    price: number;
    owner_email: string;
    run_count: number;
    created_at: string;
    external_api_url?: string;
}

export type View = 'marketplace' | 'run' | 'deploy' | 'result';
