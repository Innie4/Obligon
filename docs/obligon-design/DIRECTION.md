# Obligon station and intake interfaces
Brief: responsive web interfaces for Nigerian fuel operators and Obligon administrators. Preserve the established green/navy brand and navigation; make publication status, evidence, delivery failure and next actions explicit. No simulated business metrics.

Three directions: printed station register (light, serif, green, ruled rows), dispatch room (dark, monospace, amber, dense operational table), forecourt board (green field, bold sans, lime, signage). Winner: printed register’s content hierarchy and ruled review rows, translated into the existing web font and components. This improves form clarity without changing the dashboard identity. New interfaces use real live records, loading, error, empty and pending states.

Tokens: existing navy/green; white form surfaces; 48px primary actions; 16px inputs; 24px gutters; 2 columns desktop / 1 column mobile. Status is text as well as colour. No decorative imagery needed. Motion limited to loading feedback and existing transitions; reduced motion respected. Apple fonts are not available on this Linux host, so these are website studies, not certified iOS renders.

Integration: POST /api/partner/stations; GET /api/partner/stations; stationId selects profile and operations. Admin intake exposes job publication, protected resumes, station review, privacy decisions, delivery attempts and searchable redacted audit records. Public station discovery only sees active stations owned by verified partners.
