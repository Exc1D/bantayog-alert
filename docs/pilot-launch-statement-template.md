# Bantayog Alert — Pilot Launch Statement

**Platform:** Bantayog Alert v1.0.0-pilot  
**Document Version:** 1.0  
**Date:** ___________________

---

## 1. Pilot Scope

**Municipality:** Daet, Camarines Norte  
**Participating Agencies:** Daet MDRRMO, BFP Daet Station  
**Pilot Start Date:** ___________________ (date of PDRRMO Director signature)  
**30-Day Pilot Period Ends:** ___________________

**Included at Launch:**
- Citizen disaster reporting via web PWA (bantayog.camarines-norte.gov.ph)
- Staff admin dashboard (admin.bantayog.camarines-norte.gov.ph)
- Responder mobile app (iOS TestFlight / Android MDM)
- SMS reporting for staff-registered numbers (keyword: BANTAYOG)
- PAGASA weather alert integration (15-minute polling + manual toggle)

**Deferred — Not Included at Launch:**
- Anonymous feature-phone SMS onboarding — deferred pending resolution of RA 10173 §16
  pseudonymous erasure gap. Citizens may report via web PWA or register their SMS number
  with MDRRMO staff.

---

## 2. Service Level Objectives (Pilot Period)

Per Arch Spec §13.2:

| Metric | Target |
|--------|--------|
| Citizen submit → admin visible | ≤ 30 seconds (p95) |
| Admin verify → dispatch FCM delivery | ≤ 10 seconds |
| System availability | ≥ 99% (excl. planned maintenance) |
| Restore RTO | ≤ 4 hours |

Pilot baseline measurements recorded from Track 3 BFP field drill:

| Metric | Measured |
|--------|---------|
| Citizen submit → admin visible | ___ seconds |
| Admin verify → dispatch FCM delivery | ___ seconds |

---

## 3. Named Responsible Parties

**Named Pilot Coordinator:**  
Name: ___________________________  
Position: PDRRMO Director, Camarines Norte  
Contact: ___________________________

**Named Technical Responsible:**  
Name: David Aviado (Exxeed)  
Contact: davidaviado.dla@gmail.com

---

## 4. Operational Commitment

The undersigned acknowledge that:

1. The Bantayog Alert platform is live for real citizens and real emergencies from the date of signature.
2. The 30-day pilot operational clock starts on the signature date.
3. SLO targets in Section 2 are operational commitments for the pilot period.
4. Incidents are reviewed within 48 hours and documented in the restore drill log.
5. Anonymous SMS onboarding remains deferred and will not be activated without explicit written
   authorization confirming the RA 10173 §16 erasure gap is resolved.

---

## 5. Signature Block

**PDRRMO Director, Camarines Norte**

Signature: _____________________________

Printed Name: _____________________________

Date: _____________________________

---

**Technical Lead**

Signature: _____________________________

Printed Name: David Aviado

Date: _____________________________

---

*Scan signed copy to `docs/pilot-launch-statement-signed.pdf` and commit to the repository.*
