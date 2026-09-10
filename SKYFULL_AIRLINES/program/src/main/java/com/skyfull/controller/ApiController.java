// Triggers output f 445
//Koddan ÇAĞRILMAZLAR. Veritabanının bekçileridir, işlem yapıldığında kendileri devreye girerler.

//trg_PreventDoubleBooking
//INSERT INTO Bookings her çalıştığında devreye girer. 
//ApiController.java içinde hata yakalama bloklarında "Seat already occupied" hatasını fırlatan trigger bu.

//trg_ValidateFlightDates
//Admin yeni uçuş eklerken devreye girer. Eğer kalkış tarihi bugünden önceyse veya varıştan sonraysa işlemi reddeder. 
//Bu hatayı yakalayıp ekrana basıyoruz.

//trg_LogBookingCancellation
//Bir iptal işlemi olduğunda arka planda sessizce çalışır ve Logs tablosuna kayıt atar. 
//Bunu arayüzde görmüyoruz ama veritabanını açıp SELECT * FROM Logs dersek kayıtları görürüz.

package com.skyfull.controller;

import com.skyfull.entity.Booking;
import com.skyfull.entity.Flight;
import com.skyfull.entity.User;
import com.skyfull.repository.BookingRepository;
import com.skyfull.repository.FlightRepository;
import com.skyfull.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*") // Allow frontend to call if running separate, though same origin here
public class ApiController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private FlightRepository flightRepository;

    @Autowired
    private BookingRepository bookingRepository;

    // --- AUTH ---

    @PostMapping("/auth/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> creds) {
        try {
            String username = creds.get("username");
            String password = creds.get("password");

            System.out.println("Login attempt for: " + username);

            User user = userRepository.findByUsername(username);

            if (user == null) {
                System.out.println("User not found: " + username);
                return ResponseEntity.status(401).body("Invalid credentials (User not found)");
            }

            if (!user.getPassword().equals(password)) {
                System.out.println("Invalid password for: " + username);
                return ResponseEntity.status(401).body("Invalid credentials (Password mismatch)");
            }

            // In a real app, return JWT. Here, return User object
            return ResponseEntity.ok(user);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body("Internal Error: " + e.getMessage());
        }
    }

    @PostMapping("/auth/register")
    public ResponseEntity<?> register(@RequestBody User user) {
        try {
            // Calling SP
            userRepository.registerUser(user.getUsername(), user.getPassword(), user.getFullName(), "USER");
            return ResponseEntity.ok("User registered successfully");
        } catch (Exception e) {
            // Drill down to the root cause to find the actual SQL error
            Throwable root = e;
            while (root.getCause() != null && root.getCause() != root) {
                root = root.getCause();
            }

            String msg = root.getMessage();

            // Clean up SQL Server brackets if present e.g. "SQL Error: [Username already
            // exists]"
            if (msg != null && msg.contains("Username already exists")) {
                return ResponseEntity.badRequest().body("Username already exists");
            }

            // Fallback cleanup
            if (msg != null && msg.contains("]")) {
                int lastBracket = msg.lastIndexOf("]");
                int firstBracket = msg.lastIndexOf("[", lastBracket - 1);
                if (firstBracket != -1) {
                    msg = msg.substring(firstBracket + 1, lastBracket);
                }
            }
            return ResponseEntity.badRequest().body(msg);
        }
    }

    // --- PUBLIC / FLIGHTS ---

    @GetMapping("/flights/public")
    public ResponseEntity<?> getPublicFlights() {
        // Returns list of objects from View
        return ResponseEntity.ok(flightRepository.getPublicSchedule());
    }

    @GetMapping("/flights/{code}/occupied-seats")
    public ResponseEntity<List<String>> getOccupiedSeats(@PathVariable String code) {
        return ResponseEntity.ok(bookingRepository.getOccupiedSeats(code));
    }

    @GetMapping("/airports")
    public ResponseEntity<?> getAirports() {
        try {
            // Ensure airports exist (Safe to keep if idempotent)
            flightRepository.seedMissingAirports();

            return ResponseEntity.ok(flightRepository.getAllAirports());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // --- BOOKINGS (USER) ---

    @PostMapping("/bookings/checkin/public")
    public ResponseEntity<?> checkInPublic(@RequestBody Map<String, String> payload) {
        try {
            String bookingIdStr = payload.get("bookingId");
            String surname = payload.get("surname");

            if (bookingIdStr == null || surname == null)
                return ResponseEntity.badRequest().body("PNR (Ticket ID) and Surname are required.");

            Integer bookingId;
            try {
                bookingId = Integer.valueOf(bookingIdStr);
            } catch (NumberFormatException nfe) {
                return ResponseEntity.badRequest().body("Invalid Ticket ID/PNR format.");
            }

            Booking booking = bookingRepository.findById(bookingId).orElse(null);
            if (booking == null)
                return ResponseEntity.badRequest().body("Booking not found.");

            // Validate Surname
            String storedName = booking.getPassengerName();
            if (storedName == null) {
                // Fallback to User name if passenger name is null (compatibility)
                User u = userRepository.findById(booking.getUserId()).orElse(null);
                if (u != null)
                    storedName = u.getFullName();
            }

            // Simple check: does the full name contain the surname provided?
            if (storedName == null || !storedName.toLowerCase().contains(surname.toLowerCase().trim())) {
                return ResponseEntity.badRequest().body("Surname does not match booking records.");
            }

            bookingRepository.checkInPassenger(bookingId);
            return ResponseEntity.ok("Check-in successful for: " + storedName);

        } catch (Exception e) {
            String msg = e.getMessage();
            Throwable cause = e.getCause();
            while (cause != null) {
                if (cause.getMessage() != null && !cause.getMessage().isEmpty()) {
                    msg = cause.getMessage();
                }
                cause = cause.getCause();
            }
            if (msg.contains("24 hours")) {
                return ResponseEntity.status(400).body("Check-in is only available 24 hours before flight.");
            } else if (msg.contains("departed")) {
                return ResponseEntity.status(400).body("Flight has already departed.");
            } else if (msg.contains("Seat already occupied")) {
                return ResponseEntity.status(400).body("Issue with seat assignment. Please contact support.");
            }
            return ResponseEntity.badRequest().body("Check-in failed: " + msg);
        }
    }

    @GetMapping("/bookings/manage/public")
    public ResponseEntity<?> manageBookingPublic(@RequestParam Integer bookingId, @RequestParam String surname) {
        try {
            // Find the booking
            Booking booking = bookingRepository.findById(bookingId).orElse(null);
            if (booking == null)
                return ResponseEntity.badRequest().body("Booking not found.");

            // Validate Surname
            String storedName = booking.getPassengerName();
            if (storedName == null) {
                User u = userRepository.findById(booking.getUserId()).orElse(null);
                if (u != null)
                    storedName = u.getFullName();
            }

            if (storedName == null || !storedName.toLowerCase().contains(surname.toLowerCase().trim())) {
                return ResponseEntity.badRequest().body("Surname does not match booking records.");
            }

            // Get Flight Info
            Flight flight = flightRepository.findById(booking.getFlightId()).orElse(null);
            if (flight == null)
                return ResponseEntity.badRequest().body("Flight info not found.");

            // Get Airport Codes
            // Since flight object holds IDs, we might need a join or simple helper.
            // For simplicity and speed, let's use the repository's custom query logic or
            // fetch manually.
            // Since we need codes, let's fetch raw object list from repository that joins
            // tables.

            // Re-using the logic from single booking fetch but safer to just use a custom
            // query for single item
            // Create a temporary DTO map
            Map<String, Object> result = new HashMap<>();
            result.put("bookingId", booking.getBookingId());
            result.put("passengerName", storedName);
            result.put("type", booking.getPassengerType());
            result.put("seat", booking.getSeatNumber());
            result.put("status", booking.getStatus());
            result.put("price", booking.getTicketPrice());
            result.put("flightCode", flight.getFlightCode());
            result.put("depTime", flight.getDepartureTime().toString());

            // To get Origin/Dest codes, we can use the FlightRepository helper or just
            // return IDs if fine.
            // But we want codes (IST, ESB). Let's do a quick lookup via the list method or
            // add a specific query.
            // Adding a specific query is cleaner.

            // Let's use the detailed list query filtered by ID
            List<Object[]> details = bookingRepository.findBookingDetailsById(bookingId);
            if (details != null && !details.isEmpty()) {
                Object[] row = details.get(0);
                // [BookingID, FlightCode, Origin, Dest, DepTime, SeatNumber, Status,
                // TicketPrice, PassengerName]
                result.put("flightCode", row[1]);
                result.put("origin", row[2]);
                result.put("dest", row[3]);
                result.put("depTime", row[4].toString());
            }

            return ResponseEntity.ok(result);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.badRequest().body("Error: " + e.getMessage());
        }
    }

    @GetMapping("/flights/status/public")
    public ResponseEntity<?> getFlightStatusPublic(@RequestParam String flightCode, @RequestParam String date) {
        try {
            // date format from input type=date is YYYY-MM-DD
            // We need to match this against the database datetime.
            // Let's use a custom query in repository to be precise and robust

            List<Object[]> flights = flightRepository.searchFlightStatus(flightCode, date);

            if (flights == null || flights.isEmpty()) {
                return ResponseEntity.status(404).body("Flight not found on this date.");
            }

            // Map result to simpler object
            Object[] f = flights.get(0);
            Map<String, Object> statusInfo = new HashMap<>();
            statusInfo.put("flightCode", f[1]);
            statusInfo.put("origin", f[2]);
            statusInfo.put("dest", f[3]);
            statusInfo.put("depTime", f[4].toString());
            statusInfo.put("arrTime", f[5].toString());
            statusInfo.put("status", f[6]);
            statusInfo.put("aircraft", f[9]);

            return ResponseEntity.ok(statusInfo);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.badRequest().body("Error: " + e.getMessage());
        }
    }

    // --- Admin / Owner Endpoints ---

    @GetMapping("/owner/dashboard/stats")
    public ResponseEntity<?> getOwnerDashboardStats() {
        try {
            // 1. Auto-fix legacy data
            // flightRepository.fixLegacyBookings();

            // 2. Fetch stats
            List<Object[]> stats = flightRepository.getOwnerStats();
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.badRequest().body("Error: " + e.getMessage());
        }
    }

    @PostMapping("/bookings")
    public ResponseEntity<?> createBooking(@RequestBody Map<String, Object> payload) {
        try {
            Integer userId = (Integer) payload.get("userId");
            String flightCode = (String) payload.get("flightCode");

            Flight flight = flightRepository.findByFlightCode(flightCode);
            if (flight == null)
                return ResponseEntity.badRequest().body("Flight not found");

            @SuppressWarnings("unchecked")
            List<Map<String, String>> passengers = (List<Map<String, String>>) payload.get("passengers");

            if (passengers != null) {
                for (Map<String, String> pax : passengers) {
                    Booking booking = new Booking();
                    booking.setUserId(userId);
                    booking.setFlightId(flight.getFlightId());
                    booking.setSeatNumber(pax.get("seat"));
                    booking.setBookingDate(java.time.LocalDateTime.now());
                    booking.setStatus("CONFIRMED");

                    String type = pax.get("type"); // ADULT, STUDENT, CHILD
                    booking.setPassengerType(type);

                    String name = pax.get("name");
                    booking.setPassengerName(name);

                    // Dynamic Price Logic from DB
                    java.math.BigDecimal price = flight.getBasePrice();
                    if ("STUDENT".equals(type) && flight.getPriceStudent() != null) {
                        price = flight.getPriceStudent();
                    } else if ("CHILD".equals(type) && flight.getPriceChild() != null) {
                        price = flight.getPriceChild();
                    }

                    booking.setTicketPrice(price);

                    bookingRepository.createBookingRaw(booking);
                }
            }

            return ResponseEntity.ok("Bookings created successfully");

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.badRequest().body("Error creating booking: " + e.getMessage());
        }
    }

    @GetMapping("/my-bookings")
    public ResponseEntity<?> getUserBookings(@RequestParam Integer userId) {
        return ResponseEntity.ok(bookingRepository.findUserBookingsWithDetails(userId));
    }

    @PostMapping("/bookings/{id}/cancel")
    public ResponseEntity<?> cancelBooking(@PathVariable Integer id) {
        try {
            bookingRepository.cancelBooking(id);
            return ResponseEntity.ok("Booking cancelled");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/bookings/{id}/checkin")
    public ResponseEntity<?> checkIn(@PathVariable Integer id) {
        try {
            bookingRepository.checkInPassenger(id);
            return ResponseEntity.ok("Check-in successful");
        } catch (Exception e) {
            // Extract the actual error message from the nested exception
            String msg = e.getMessage();
            Throwable cause = e.getCause();
            while (cause != null) {
                if (cause.getMessage() != null && !cause.getMessage().isEmpty()) {
                    msg = cause.getMessage();
                }
                cause = cause.getCause();
            }

            // Clean up common JDBC prefixes if present (though loop above often hits the
            // raw SQL error)
            // If the message is still technical, fall back to friendly text if possible
            if (msg.contains("24 hours")) {
                return ResponseEntity.status(400).body("Check-in is only available 24 hours before flight.");
            } else if (msg.contains("departed")) {
                return ResponseEntity.status(400).body("Flight has already departed.");
            }

            return ResponseEntity.badRequest().body(msg);
        }
    }

    // --- ADMIN ---

    // Simplification: We usually need SP CreateFlight logic
    // But SP CreateFlight requires specific params.
    @PostMapping("/admin/flight")
    public ResponseEntity<?> createFlight(@RequestBody Map<String, Object> payload) {
        try {
            String flightCode = (String) payload.get("flightCode");
            String origin = (String) payload.get("originCode");
            String dest = (String) payload.get("destCode");

            String depStr = (String) payload.get("departureTime");
            String arrStr = (String) payload.get("arrivalTime");

            java.time.LocalDateTime depTime = java.time.LocalDateTime.parse(depStr);
            java.time.LocalDateTime arrTime = java.time.LocalDateTime.parse(arrStr);

            // Validation: Cannot schedule in past
            if (depTime.isBefore(java.time.LocalDateTime.now())) {
                return ResponseEntity.badRequest().body("Error: Departure time cannot be in the past.");
            }

            String aircraft = (String) payload.get("aircraftType");
            Integer seats = Integer.valueOf(payload.get("totalSeats").toString());

            // Enforce Max Capacity Rule
            if (seats > 150) {
                seats = 150;
            }

            BigDecimal price = new BigDecimal(payload.get("basePrice").toString());

            // New dynamic prices
            BigDecimal pStudent = payload.get("priceStudent") != null
                    && !payload.get("priceStudent").toString().isEmpty()
                            ? new BigDecimal(payload.get("priceStudent").toString())
                            : price.multiply(new BigDecimal("0.8"));

            BigDecimal pChild = payload.get("priceChild") != null && !payload.get("priceChild").toString().isEmpty()
                    ? new BigDecimal(payload.get("priceChild").toString())
                    : price.multiply(new BigDecimal("0.5"));

            flightRepository.createFlightRaw(flightCode, origin, dest, depTime, arrTime, aircraft, seats, price,
                    pStudent, pChild);

            return ResponseEntity.ok("Flight created successfully");
        } catch (Exception e) {
            // Check for duplicate key constraint violation
            String msg = e.getMessage();
            Throwable cause = e.getCause();

            // Unpack deeper SQL exceptions
            while (cause != null) {
                if (cause.getMessage() != null) {
                    msg = cause.getMessage();
                    if (msg.contains("Arrival time must be after Departure time")) {
                        return ResponseEntity.badRequest()
                                .body("Error: Arrival time must be later than Departure time.");
                    }
                }
                cause = cause.getCause();
            }

            if (msg != null && (msg.contains("UNIQUE KEY") || msg.contains("duplicate key"))) {
                return ResponseEntity.badRequest()
                        .body("Error: Flight Code already exists. Please use a different code.");
            }
            if (msg != null && msg.contains("Arrival time must be after Departure time")) {
                return ResponseEntity.badRequest().body("Error: Arrival time must be later than Departure time.");
            }

            e.printStackTrace();
            return ResponseEntity.badRequest().body("Error creating flight: " + msg);
        }
    }

    @GetMapping("/admin/flights/{id}/passengers")
    public ResponseEntity<?> getPassengers(@PathVariable Integer id) {
        try {
            return ResponseEntity.ok(bookingRepository.getFlightPassengers(id));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/admin/flights/code/{code}/passengers")
    public ResponseEntity<?> getPassengersByCode(@PathVariable String code) {
        try {
            return ResponseEntity.ok(bookingRepository.getFlightPassengersByCode(code));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/admin/flights/{id}/status")
    public ResponseEntity<?> updateFlightStatus(@PathVariable Integer id, @RequestBody Map<String, String> payload) {
        try {
            String status = payload.get("status");
            flightRepository.updateStatus(id, status);

            if ("CANCELLED".equals(status)) {
                flightRepository.cancelBookingsByFlightId(id);
            }

            return ResponseEntity.ok("Flight status updated to: " + status);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PutMapping("/admin/flights/{id}")
    public ResponseEntity<?> updateFlight(@PathVariable Integer id, @RequestBody Map<String, Object> payload) {
        try {
            return flightRepository.findById(id).map(flight -> {
                if (payload.containsKey("departureTime"))
                    flight.setDepartureTime(java.time.LocalDateTime.parse((String) payload.get("departureTime")));
                if (payload.containsKey("arrivalTime"))
                    flight.setArrivalTime(java.time.LocalDateTime.parse((String) payload.get("arrivalTime")));
                if (payload.containsKey("basePrice"))
                    flight.setBasePrice(new java.math.BigDecimal(payload.get("basePrice").toString()));
                if (payload.containsKey("aircraftType"))
                    flight.setAircraftType((String) payload.get("aircraftType"));
                if (payload.containsKey("totalSeats"))
                    flight.setTotalSeats(Integer.valueOf(payload.get("totalSeats").toString()));

                flightRepository.save(flight);
                return ResponseEntity.ok("Flight updated successfully");
            }).orElse(ResponseEntity.badRequest().body("Flight not found"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Error updating flight: " + e.getMessage());
        }
    }

    // --- OWNER ---

    @GetMapping("/admin/flights")
    public ResponseEntity<?> getAllFlightsForAdmin() {
        try {
            flightRepository.updateFlightStatuses();
        } catch (Exception e) {
            /* Ignore if SP missing */ }

        List<Object[]> rawFlights = flightRepository.findAllWithAirportCodes();
        java.util.List<Map<String, Object>> flights = new java.util.ArrayList<>();

        for (Object[] row : rawFlights) {
            Map<String, Object> map = new HashMap<>();
            map.put("flightId", row[0]);
            map.put("flightCode", row[1]);
            map.put("originCode", row[2]);
            map.put("destCode", row[3]);
            map.put("departureTime", row[4].toString());
            map.put("arrivalTime", row[5].toString());
            map.put("status", row[6]);
            map.put("basePrice", row[7]);
            map.put("totalSeats", row[8]);
            map.put("aircraftType", row[9]);
            flights.add(map);
        }
        return ResponseEntity.ok(flights);
    }

    @GetMapping("/owner/stats")
    public ResponseEntity<?> getOwnerStats() {
        return ResponseEntity.ok(flightRepository.getOwnerStats());
    }
}
