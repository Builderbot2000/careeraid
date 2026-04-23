import { BaseAdapter } from './base'
import type { JobPosting, SearchFilters } from './base'

const MOD_VERSION = '0.1.0-mock'
const SOURCE = 'mock'

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

const BASE_FIELDS = {
  resolved_domain: null,
  applicant_count: null,
  scraper_mod_version: MOD_VERSION,
  source: SOURCE,
  status: 'new' as const,
  affinity_score: null,
  affinity_skipped: false,
  affinity_scored_at: null,
  first_response_at: null,
}

const MOCK_POSTINGS: Omit<JobPosting, 'id'>[] = [
  {
    ...BASE_FIELDS,
    url: 'https://news.ycombinator.com/item?id=39000001',
    title: 'Senior Backend Engineer',
    company: 'Stripe',
    location: 'remote',
    yoe_min: 5,
    yoe_max: null,
    seniority: 'senior',
    tech_stack: ['Go', 'Ruby', 'PostgreSQL', 'Kubernetes'],
    posted_at: daysAgo(1),
    fetched_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    raw_text: `Stripe is hiring a Senior Backend Engineer for our Payments Infrastructure team. You will design and scale the systems that process billions of dollars in transactions annually.

Responsibilities:
- Build fault-tolerant distributed systems at 10K+ TPS
- Own reliability of core payment flows end to end
- Drive cross-team architecture decisions

Requirements:
- 5+ years backend engineering experience
- Strong distributed systems and database internals knowledge
- Experience with Go or Ruby at scale
- Familiarity with Kubernetes and PostgreSQL under heavy load

Remote-friendly. Offices in SF, Seattle, NYC, Dublin.`,
  },
  {
    ...BASE_FIELDS,
    url: 'https://news.ycombinator.com/item?id=39000002',
    title: 'Staff Software Engineer, Infrastructure',
    company: 'Vercel',
    location: 'remote',
    yoe_min: 8,
    yoe_max: null,
    seniority: 'staff',
    tech_stack: ['TypeScript', 'Rust', 'Next.js', 'AWS'],
    posted_at: daysAgo(2),
    fetched_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    raw_text: `Vercel is looking for a Staff Software Engineer to join the Infrastructure team. You will define the architecture of our global edge network and help scale the platform that serves millions of deployments per day.

You will:
- Lead technical direction for the edge compute platform
- Design systems for low-latency global request routing
- Mentor senior engineers and drive cross-team initiatives

Requirements:
- 8+ years engineering with a systems background
- Deep knowledge of network protocols and edge computing
- Experience with Rust or C++ for performance-critical paths
- Track record of leading large-scale infrastructure projects

Fully remote.`,
  },
  {
    ...BASE_FIELDS,
    url: 'https://news.ycombinator.com/item?id=39000003',
    title: 'Software Engineer, Frontend',
    company: 'Linear',
    location: 'remote',
    yoe_min: 3,
    yoe_max: 6,
    seniority: 'mid',
    tech_stack: ['TypeScript', 'React', 'GraphQL'],
    posted_at: daysAgo(3),
    fetched_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    raw_text: `Linear is building the issue tracking tool that developers actually want to use. We're hiring a Frontend Engineer to work on the core product experience.

What you'll work on:
- Real-time collaborative editing and sync
- High-performance list and graph views
- Keyboard-driven interaction patterns

Requirements:
- 3+ years React and TypeScript experience
- Strong eye for polish and performance
- Familiarity with GraphQL and WebSockets
- Experience with offline-first or real-time applications is a plus

Remote. Small team, high impact.`,
  },
  {
    ...BASE_FIELDS,
    url: 'https://news.ycombinator.com/item?id=39000004',
    title: 'Senior Full-Stack Engineer',
    company: 'Figma',
    location: 'hybrid — New York, NY',
    yoe_min: 5,
    yoe_max: null,
    seniority: 'senior',
    tech_stack: ['TypeScript', 'React', 'Python', 'WebAssembly'],
    posted_at: daysAgo(4),
    fetched_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    raw_text: `Figma is looking for a Senior Full-Stack Engineer to work on our collaborative editing infrastructure and product surfaces.

Responsibilities:
- Build the web and server layers powering real-time multiplayer design
- Collaborate with design and product to ship new product features
- Improve performance and reliability of the Figma web editor

Requirements:
- 5+ years full-stack experience (TypeScript, Python or similar)
- Strong understanding of browser rendering and performance
- Experience building products used by millions of concurrent users
- Familiarity with WebAssembly a plus

Hybrid — NYC office 3 days/week.`,
  },
  {
    ...BASE_FIELDS,
    url: 'https://news.ycombinator.com/item?id=39000005',
    title: 'Senior Platform Engineer',
    company: 'Fly.io',
    location: 'remote',
    yoe_min: 5,
    yoe_max: null,
    seniority: 'senior',
    tech_stack: ['Go', 'Rust', 'Nix', 'Linux'],
    posted_at: daysAgo(5),
    fetched_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    raw_text: `Fly.io runs applications close to users around the world. We're hiring a Senior Platform Engineer to work on the systems that orchestrate thousands of Firecracker VMs across our global network.

You'll:
- Build and maintain the control plane that manages VM lifecycle
- Work on low-level networking (WireGuard, BGP, anycast)
- Ship features that directly affect developer experience

Requirements:
- 5+ years systems programming (Go, Rust, or C)
- Deep Linux internals knowledge (namespaces, cgroups, networking)
- Experience with distributed systems orchestration
- Comfort debugging at the kernel level

Fully remote. Async-first culture.`,
  },
  {
    ...BASE_FIELDS,
    url: 'https://news.ycombinator.com/item?id=39000006',
    title: 'Senior Software Engineer, Site Reliability',
    company: 'GitHub',
    location: 'remote',
    yoe_min: 5,
    yoe_max: null,
    seniority: 'senior',
    tech_stack: ['Go', 'Ruby', 'Kubernetes', 'Prometheus'],
    posted_at: daysAgo(7),
    fetched_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    raw_text: `GitHub is looking for a Senior SRE to join the team responsible for keeping GitHub.com available and performant for 100 million+ developers.

Responsibilities:
- Own availability and latency SLOs for critical platform services
- Build tooling and automation to reduce toil at scale
- Partner with product engineering teams on reliability design
- Drive incident response and postmortem culture

Requirements:
- 5+ years SRE or platform engineering experience
- Strong proficiency in Go or Ruby
- Deep Kubernetes operational experience
- Experience with Prometheus, Grafana, and alerting design

Remote-first with optional hub offices.`,
  },
  {
    ...BASE_FIELDS,
    url: 'https://news.ycombinator.com/item?id=39000007',
    title: 'Senior Backend Engineer',
    company: 'Shopify',
    location: 'remote',
    yoe_min: 5,
    yoe_max: null,
    seniority: 'senior',
    tech_stack: ['Ruby', 'Go', 'GraphQL', 'MySQL'],
    posted_at: daysAgo(8),
    fetched_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    raw_text: `Shopify is hiring a Senior Backend Engineer to scale the commerce platform powering over 2 million merchants worldwide.

What you'll do:
- Build and scale APIs serving billions of requests per month
- Design for multi-tenancy and extreme traffic spikes (BFCM)
- Contribute to our GraphQL API surface and backend services
- Collaborate with platform and data teams

Requirements:
- 5+ years backend experience
- Deep Ruby on Rails experience (our primary stack)
- Familiarity with Go for performance-critical services
- Experience with MySQL at scale
- Understanding of distributed systems trade-offs

Remote-first globally.`,
  },
  {
    ...BASE_FIELDS,
    url: 'https://news.ycombinator.com/item?id=39000008',
    title: 'Backend Engineer',
    company: 'Discord',
    location: 'remote',
    yoe_min: 3,
    yoe_max: 6,
    seniority: 'mid',
    tech_stack: ['Python', 'Rust', 'Elixir', 'Cassandra'],
    posted_at: daysAgo(10),
    fetched_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    raw_text: `Discord is building the place where communities thrive. We're hiring a Backend Engineer to work on the messaging and real-time infrastructure serving 500 million registered users.

Responsibilities:
- Build and maintain low-latency message delivery pipelines
- Work across Python, Elixir, and Rust service boundaries
- Improve scalability of our Cassandra-backed storage layer
- Ship features that delight communities of every size

Requirements:
- 3+ years backend engineering
- Experience with at least one of: Python, Elixir, Rust
- Comfort with distributed systems and eventual consistency
- Familiarity with NoSQL data modeling

Remote-eligible (US).`,
  },
  {
    ...BASE_FIELDS,
    url: 'https://news.ycombinator.com/item?id=39000009',
    title: 'Staff Engineer, Database Platform',
    company: 'PlanetScale',
    location: 'remote',
    yoe_min: 8,
    yoe_max: null,
    seniority: 'staff',
    tech_stack: ['Go', 'MySQL', 'Kubernetes', 'Vitess'],
    posted_at: daysAgo(12),
    fetched_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    raw_text: `PlanetScale is the MySQL-compatible serverless database platform. We're looking for a Staff Engineer to lead development on the core database engine and sharding infrastructure.

You will:
- Lead architecture decisions on the Vitess-based sharding layer
- Drive reliability and performance improvements across the platform
- Define technical direction for the database platform roadmap
- Partner with customers on complex schema and query optimisation

Requirements:
- 8+ years with databases, storage systems, or distributed systems
- Deep MySQL and/or Vitess internals knowledge
- Strong Go engineering skills
- Experience with large-scale multi-tenant SaaS infrastructure

Fully remote.`,
  },
  {
    ...BASE_FIELDS,
    url: 'https://news.ycombinator.com/item?id=39000010',
    title: 'Senior Frontend Engineer',
    company: 'Notion',
    location: 'hybrid — San Francisco, CA',
    yoe_min: 5,
    yoe_max: null,
    seniority: 'senior',
    tech_stack: ['TypeScript', 'React', 'Next.js', 'PostgreSQL'],
    posted_at: daysAgo(13),
    fetched_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    raw_text: `Notion is the all-in-one workspace for teams. We're hiring a Senior Frontend Engineer to work on the core editor and document model that millions of people use every day.

Responsibilities:
- Architect and build the block-based collaborative editor
- Work on rendering performance for large, complex documents
- Collaborate closely with product and design
- Improve our real-time sync and conflict resolution layer

Requirements:
- 5+ years React and TypeScript
- Deep understanding of browser performance and rendering
- Experience with collaborative or rich-text editing a strong plus
- Comfortable working across the stack (our backend is PostgreSQL + Node)

Hybrid in SF — 3 days/week in office.`,
  },
  {
    ...BASE_FIELDS,
    url: 'https://news.ycombinator.com/item?id=39000011',
    title: 'Backend Engineer',
    company: 'Supabase',
    location: 'remote',
    yoe_min: 3,
    yoe_max: 7,
    seniority: 'mid',
    tech_stack: ['TypeScript', 'Go', 'PostgreSQL', 'Rust'],
    posted_at: daysAgo(15),
    fetched_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    raw_text: `Supabase is building the open source Firebase alternative. We're looking for a Backend Engineer to work on the platform that helps developers build faster.

What you'll work on:
- PostgREST integration and auto-generated API layer
- Realtime subscription engine (built on Elixir/Phoenix)
- Database branching and migration tooling
- Auth, storage, and edge function primitives

Requirements:
- 3+ years backend engineering
- Deep PostgreSQL knowledge (extensions, RLS, triggers)
- Experience with TypeScript or Go
- Interest in developer tooling and open source

Fully remote, async-first.`,
  },
  {
    ...BASE_FIELDS,
    url: 'https://news.ycombinator.com/item?id=39000012',
    title: 'Senior Software Engineer',
    company: 'Deno',
    location: 'remote',
    yoe_min: 5,
    yoe_max: null,
    seniority: 'senior',
    tech_stack: ['TypeScript', 'Rust', 'V8', 'WebAssembly'],
    posted_at: daysAgo(17),
    fetched_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    raw_text: `Deno is building the next generation JavaScript and TypeScript runtime. We're hiring a Senior Software Engineer to work on the Deno runtime, standard library, and Deno Deploy edge platform.

You'll:
- Contribute to the Deno runtime (Rust + V8)
- Design and implement TypeScript APIs and standard library modules
- Work on Deno Deploy — serverless TypeScript execution at the edge
- Engage with the open source community

Requirements:
- 5+ years software engineering
- Strong Rust or C++ systems programming skills
- Deep understanding of JavaScript/TypeScript runtimes
- Familiarity with WebAssembly

Remote. Small tight-knit team.`,
  },
  {
    ...BASE_FIELDS,
    url: 'https://news.ycombinator.com/item?id=39000013',
    title: 'Full-Stack Engineer',
    company: 'Railway',
    location: 'remote',
    yoe_min: 2,
    yoe_max: 5,
    seniority: 'mid',
    tech_stack: ['TypeScript', 'React', 'Go', 'PostgreSQL'],
    posted_at: daysAgo(20),
    fetched_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    raw_text: `Railway makes deployment so easy it gets out of your way. We're hiring a Full-Stack Engineer to work across the dashboard, CLI, and infrastructure API.

Responsibilities:
- Build the Railway dashboard and CLI in TypeScript
- Work on the Go-based infrastructure orchestration API
- Ship features that reduce developer friction from code to production
- Participate in on-call and own reliability of your features

Requirements:
- 2+ years full-stack engineering
- Proficiency in TypeScript/React for frontend
- Comfortable with Go or similar for backend services
- Interest in developer tooling and deployment infrastructure

Fully remote. Early-stage startup.`,
  },
  {
    ...BASE_FIELDS,
    url: 'https://news.ycombinator.com/item?id=39000014',
    title: 'Senior Backend Engineer',
    company: 'Loom',
    location: 'hybrid — San Francisco, CA',
    yoe_min: 5,
    yoe_max: null,
    seniority: 'senior',
    tech_stack: ['Python', 'Go', 'PostgreSQL', 'AWS'],
    posted_at: daysAgo(22),
    fetched_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    raw_text: `Loom is the video messaging tool that helps teams communicate faster. We're hiring a Senior Backend Engineer to scale the video processing and delivery infrastructure.

Responsibilities:
- Own the video ingestion, transcoding, and delivery pipeline
- Build scalable APIs serving a rapidly growing user base
- Collaborate with ML team on AI-powered video features
- Drive backend reliability and performance initiatives

Requirements:
- 5+ years backend experience (Python and/or Go)
- Experience with video processing or media infrastructure a strong plus
- Deep understanding of AWS services at scale
- Comfort with PostgreSQL and data modeling

Hybrid in SF — 2 days/week in office.`,
  },
  {
    ...BASE_FIELDS,
    url: 'https://news.ycombinator.com/item?id=39000015',
    title: 'Senior Software Engineer',
    company: 'Airbnb',
    location: 'hybrid — San Francisco, CA',
    yoe_min: 5,
    yoe_max: null,
    seniority: 'senior',
    tech_stack: ['Java', 'Ruby', 'React', 'Kafka'],
    posted_at: daysAgo(25),
    fetched_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    raw_text: `Airbnb is where the world goes to experience travel differently. We're hiring a Senior Software Engineer to work on the core marketplace and payments platform.

What you'll do:
- Build and scale microservices powering search, booking, and payments
- Collaborate with product, design, and data science on new features
- Drive technical excellence through design reviews and mentorship
- Own reliability of high-traffic, revenue-critical systems

Requirements:
- 5+ years software engineering
- Proficiency in Java or Ruby (our primary backend languages)
- Experience with event-driven architectures (Kafka or similar)
- Comfort working across the stack including React
- Strong communication and collaboration skills

Hybrid in SF — flexible schedule.`,
  },
]

export class MockAdapter extends BaseAdapter {
  override readonly delayMs = 0
  override readonly availableSignals = new Set(['recency'])

  override async search(
    _term: string,
    _filters: SearchFilters,
  ): Promise<Omit<JobPosting, 'id'>[]> {
    return MOCK_POSTINGS
  }
}
