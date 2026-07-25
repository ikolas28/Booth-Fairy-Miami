

## Website Rules

- Do not break the current live public website
- Treat [`website/`](C:\Users\andyy\OneDrive\Documents\Andy's projects\Photo Booth website\website) as the source of truth for the public site
- Treat the repository root as the deployment/router layer, not the place for customer-facing website files
- Only make public website changes when they directly support bookings, trust, or lead capture

# Booth Fairy Miami Agent System

Business:
Booth Fairy Miami offers a DSLR Print Photo Booth with instant prints and instant digital sharing. The company also offers high-end DJ services for Miami and South Florida events.

## Brand Voice
Luxury, modern, fun, professional, Miami-style elegance.

## Rules
- Offer the DSLR Print Photo Booth with instant prints at the published package prices: 2 hours $450, 3 hours $575, and 4 hours $700.
- Always mention digital sharing.
- Never confirm booking without checking calendar availability.
- Never auto-confirm pricing discounts.
- Use Gmail drafts first before auto-sending.
- Store all leads in Google Sheets.
- Promote DJ services as premium add-on.

Website:
https://www.boothfairymiami.com

Current tools:
- Website built with Codex
- Domain on Squarespace
- Tidio AI chat installed
- Gmail email
- Stripe account
- Google Calendar
- Possible Calendly booking integration
- Instagram for marketing and lead generation

Main goal:
Build a custom CRM and automation system that supports two agents:
1. Receptionist Agent
2. Marketing Agent

Receptionist Agent:
- Reads incoming Gmail leads.
- Reads website form leads.
- Reads Tidio chat leads if integration is available.
- Creates or updates CRM contact records.
- Creates or updates booking records.
- Drafts professional email replies.
- Sends booking links through Calendly or Google Calendar.
- Sends Stripe payment links or invoice links.
- Tracks lead status.
- Schedules follow-ups.
- Never confirms availability unless calendar is checked.
- Never confirms booking unless deposit/payment status is confirmed.
- Always describe current photo booth packages as including instant prints and instant digital sharing.
- Use a 50% reservation retainer: $225 for 2 hours, $287.50 for 3 hours, and $350 for 4 hours.
- Do not create automatic Stripe links for DJ, bundle, discount, travel, or custom quotes until the owner approves the total.

Marketing Agent:
- Creates website SEO content.
- Creates Instagram captions.
- Creates Google Business Profile posts.
- Creates email campaigns.
- Creates ad campaign drafts for Meta Ads and Google Ads.
- Tracks campaign ideas inside the CRM.
- Can prepare campaigns, but should not publish paid ads without owner approval.
- Promotes DSLR-quality photos, instant prints, instant digital sharing, luxury event setup, and high-end DJ services.

CRM Requirements:
Create a custom CRM with:
- Leads table
- Contacts table
- Events/bookings table
- Follow-ups table
- Quotes table
- Payments table
- Marketing campaigns table
- Message history table

Lead statuses:
New Lead
Missing Info
Quote Sent
Follow-Up Needed
Booked
Deposit Pending
Paid
Completed
Lost

Booking fields:
Client name
Email
Phone
Event type
Event date
Start time
End time
Venue
City
Service requested
Guest count
Package interest
Budget
Deposit status
Payment link
Calendar link
Notes

Automation rules:
- If new lead arrives, create CRM record.
- If event date is missing, ask for date.
- If venue/city is missing, ask for venue or city.
- If phone number is missing, ask for phone number.
- If client asks for pricing, send package information or quote request form.
- If client wants to book, send calendar booking link.
- If client is ready to pay, create/send Stripe payment link or invoice.
- If no reply after 24-48 hours, create follow-up task.
