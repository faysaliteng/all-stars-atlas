-- Migration: Add PNR and ticketing columns to bookings table
-- Run: mysql -u root seventrip < backend/database/pnr-column-migration.sql

-- PNR locator from GDS (Sabre, BDFare, TTI)
ALTER TABLE bookings ADD COLUMN pnr VARCHAR(10) NULL AFTER booking_ref;
ALTER TABLE bookings ADD COLUMN ticket_status ENUM('not_issued', 'pending_issue', 'issued', 'void') DEFAULT 'not_issued' AFTER status;
ALTER TABLE bookings ADD COLUMN ticket_number VARCHAR(50) NULL AFTER ticket_status;
ALTER TABLE bookings ADD COLUMN provider VARCHAR(30) NULL AFTER ticket_number;
ALTER TABLE bookings ADD COLUMN route VARCHAR(100) NULL AFTER provider;
ALTER TABLE bookings ADD COLUMN ticketed_at DATETIME NULL AFTER route;

-- Index for PNR lookups
ALTER TABLE bookings ADD INDEX idx_bookings_pnr (pnr);
ALTER TABLE bookings ADD INDEX idx_bookings_ticket_status (ticket_status);
