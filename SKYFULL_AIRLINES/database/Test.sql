USE SkyfullDB;
GO


SELECT * FROM Bookings
SELECT * FROM Flights
SELECT * FROM Logs
SELECT * FROM Airports


-- ======================================================================
-- ORTAM HAZIRLIÐI 
-- ======================================================================
-- 1. Havalimanlarýný Ekliyorum
INSERT INTO Airports (Code, City, Name) SELECT 'SAW', 'Istanbul', 'Sabiha Gokcen Airport' WHERE NOT EXISTS (SELECT 1 FROM Airports WHERE Code = 'SAW');
INSERT INTO Airports (Code, City, Name) SELECT 'AYT', 'Antalya', 'Antalya Airport' WHERE NOT EXISTS (SELECT 1 FROM Airports WHERE Code = 'AYT');
INSERT INTO Airports (Code, City, Name) SELECT 'ADB', 'Izmir', 'Adnan Menderes Airport' WHERE NOT EXISTS (SELECT 1 FROM Airports WHERE Code = 'ADB');
INSERT INTO Airports (Code, City, Name) SELECT 'IST', 'Istanbul', 'Istanbul Airport' WHERE NOT EXISTS (SELECT 1 FROM Airports WHERE Code = 'IST');
INSERT INTO Airports (Code, City, Name) SELECT 'ESB', 'Ankara', 'Esenboga Airport' WHERE NOT EXISTS (SELECT 1 FROM Airports WHERE Code = 'ESB');

-- 2. Test Uçuþu Ekliyorum
INSERT INTO Flights (FlightCode, OriginID, DestinationID, DepartureTime, ArrivalTime, Status, BasePrice, TotalSeats, AircraftType)
SELECT 'DEMO-999', (SELECT TOP 1 AirportID FROM Airports WHERE Code='IST'), (SELECT TOP 1 AirportID FROM Airports WHERE Code='ESB'), DATEADD(day, 2, GETDATE()), DATEADD(day, 2, DATEADD(hour, 2, GETDATE())), 'SCHEDULED', 1500.00, 100, 'Demo Jet'
WHERE NOT EXISTS (SELECT 1 FROM Flights WHERE FlightCode = 'DEMO-999');

-- 3. Test Yolcusu Ekliyorum
INSERT INTO Bookings (UserID, FlightID, SeatNumber, Status, TicketPrice, PassengerType, PassengerName)
SELECT (SELECT TOP 1 UserID FROM Users), (SELECT FlightID FROM Flights WHERE FlightCode='DEMO-999'), '1A', 'CONFIRMED', 1500.00, 'ADULT', 'Demo Yolcu'
WHERE NOT EXISTS (SELECT 1 FROM Bookings WHERE PassengerName='Demo Yolcu' AND FlightID=(SELECT FlightID FROM Flights WHERE FlightCode='DEMO-999'));



-- ======================================================================
-- AÞAMA 1: FONKSÝYONLAR 
-- ======================================================================

------------- BLOK 1: UÇUÞ SÜRESÝ HESAPLAMA (fn_GetFlightDuration) -------------
-- Ýki tarih arasýndaki farký alýp "2 saat 15 dk" formatýna çeviriyor.
SELECT FlightCode, DepartureTime, ArrivalTime, 
       dbo.fn_GetFlightDuration(FlightID) as [Hesaplanan Süre]
FROM Flights 
WHERE FlightCode = 'DEMO-999';

------------- BLOK 2: KALAN KOLTUK SAYISI (fn_GetAvailableSeats) -------------
-- 100 kiþilik uçakta 1 bilet sattýk, bize 99 dönmeli.
SELECT FlightCode, TotalSeats,
       dbo.fn_GetAvailableSeats(FlightID) as [Kalan Koltuk Sayýsý]
FROM Flights 
WHERE FlightCode = 'DEMO-999';

------------- BLOK 3: CÝRO HESABI (fn_FlightRevenue) -------------
-- Uçuþun ne kadar para kazandýrdýðýný hesaplýyor.
SELECT FlightCode, 
       dbo.fn_FlightRevenue(FlightID) as [Toplam Ciro (TL)]
FROM Flights 
WHERE FlightCode = 'DEMO-999';



-- ======================================================================
-- AÞAMA 2: GÖRÜNÜMLER 
-- ======================================================================

------------- BLOK 4: KULLANICI EKRANI RAPORU (vw_PublicFlightSchedule) -------------
-- Kullanýcýnýn gördüðü son hali 
SELECT * FROM vw_PublicFlightSchedule 
WHERE FlightCode = 'DEMO-999';

------------- BLOK 5: PATRON EKRANI RAPORU (vw_OwnerDashboard) -------------
-- Ciro ve doluluk oranlarýný gösteren özet tablo.
SELECT * FROM vw_OwnerDashboard
WHERE FlightCode = 'DEMO-999';



-- ======================================================================
-- AÞAMA 3: SAKLI YORDAMLAR 
-- ======================================================================

------------- BLOK 6: YOLCU LÝSTESÝ (sp_GetFlightPassengers) -------------
-- Admin panelindeki "Yolcu Listelemek" iþlemini simüle ediyorum.
DECLARE @FID INT = (SELECT TOP 1 FlightID FROM Flights WHERE FlightCode = 'DEMO-999');
EXEC sp_GetFlightPassengers @FlightID = @FID;

------------- BLOK 7: YENÝ UÇUÞ EKLEME (sp_CreateFlight) -------------
-- SAW -> AYT uçuþu ekliyorum. (Havalimaný kodlarý artýk veritabanýnda var)
EXEC sp_CreateFlight 
    @FlightCode = 'YENI-001', 
    @OriginCode = 'SAW', 
    @DestCode = 'AYT', 
    @DepTime = '2025-12-31 10:00:00', 
    @ArrTime = '2025-12-31 11:30:00', 
    @Aircraft = 'Boeing 737', 
    @Seats = 180, 
    @Price = 2000.00;
-- Eklendiðini gösteriyorum:
SELECT * FROM Flights WHERE FlightCode = 'YENI-001';

------------- BLOK 8: CHECK-IN DENEMESÝ (sp_CheckInPassenger) -------------
-- NOT: Burada hata gelmeli ("Check-in is only allowed within 24 hours").
-- Çünkü uçuþ tarihi bugünden 2 gün sonra. 
DECLARE @CheckInBookingID INT = (SELECT TOP 1 BookingID FROM Bookings WHERE PassengerName = 'Demo Yolcu');
EXEC sp_CheckInPassenger @BookingID = @CheckInBookingID;



-- ======================================================================
-- AÞAMA 3.5: KULLANICI ÝÞLEMLERÝ 
-- ======================================================================

------------- BLOK 9: YENÝ KULLANICI KAYDI (sp_RegisterUser) -------------
-- 1. Baþarýlý Kayýt
EXEC sp_RegisterUser @Username='DemoUser', @Password='123456', @FullName='Demo Kullanici', @Role='USER';

-- Kaydýn geldiðini gör:
SELECT * FROM Users WHERE Username = 'DemoUser';

------------- BLOK 10: AYNI KULLANICIYI TEKRAR KAYDETME (HATA TESTÝ) -------------
-- Ayný kullanýcý adýyla tekrar kayýt denersek "Username already exists" hatasý almalýyýz.
BEGIN TRY
    EXEC sp_RegisterUser @Username='DemoUser', @Password='999999', @FullName='Taklitçi', @Role='USER';
END TRY
BEGIN CATCH
    SELECT ERROR_MESSAGE() AS [Beklenen Kayýt Hatasý];
END CATCH

------------- BLOK 11: LOGIN SÝMÜLASYONU (Giriþ Kontrolü) -------------
-- Login iþlemi genelde SELECT ile yapýlýr. Þifre doðruysa veri gelir.
-- a) DOÐRU ÞÝFRE (123456) -> Veri DÖNER
SELECT 'Login Baþarýlý' AS Durum, * FROM Users WHERE Username='DemoUser' AND PasswordHash='123456';

-- b) YANLIÞ ÞÝFRE (999999) -> Veri DÖNMEZ (Boþ tablo)
SELECT 'Login Hatalý' AS Durum, * FROM Users WHERE Username='DemoUser' AND PasswordHash='999999';



-- ======================================================================
-- AÞAMA 4: TETÝKLEYÝCÝLER (TRIGGERS - HATA YAKALAMA)
-- ======================================================================

------------- BLOK 9: HATALI TARÝH KORUMASI (trg_ValidateFlightDates) -------------
-- Varýþ tarihini geçmiþe çekmeye çalýþalým. Trigger engelleyecek.
BEGIN TRY
    UPDATE Flights SET ArrivalTime = '2020-01-01' WHERE FlightCode = 'DEMO-999';
END TRY
BEGIN CATCH
    SELECT ERROR_MESSAGE() AS [Gelen Hata Mesajý];
END CATCH

------------- BLOK 10: ÇÝFTE REZERVASYON KORUMASI (trg_PreventDoubleBooking) -------------
-- '1A' koltuðu dolu. Zorla ayný koltuða kayýt yapmaya çalýþýyorum.
BEGIN TRY
    DECLARE @TriggerFLID INT = (SELECT TOP 1 FlightID FROM Flights WHERE FlightCode = 'DEMO-999');
    DECLARE @TriggerUserID INT = (SELECT TOP 1 UserID FROM Users);
    
    INSERT INTO Bookings (UserID, FlightID, SeatNumber, Status, TicketPrice)
    VALUES (@TriggerUserID, @TriggerFLID, '1A', 'CONFIRMED', 1500); 
END TRY
BEGIN CATCH
    SELECT ERROR_MESSAGE() AS [Gelen Hata Mesajý];
END CATCH

------------- BLOK 11: ÝPTAL LOGLAMA (trg_LogBookingCancellation) -------------
-- Bileti iptal edip Log tablosunu kontrol ediyorum.
UPDATE Bookings SET Status = 'CANCELLED' WHERE PassengerName = 'Demo Yolcu';

-- Loglarý görelim:
SELECT TOP 1 * FROM Logs ORDER BY LogID DESC;



------------- BLOK 12: UÇUÞ ÝNDÝRME VE LOG KONTROLÜ (trg_LogFlightCompletion) -------------
-- 1. Demo Uçuþunu 'COMPLETED' (Tamamlandý) durumuna çekiyorum.
-- Bu iþlem trigger'ý tetikleyecek ve Logs tablosuna Flight DEMO-999 has landed." yazmalý.
UPDATE Flights SET Status = 'COMPLETED' WHERE FlightCode = 'DEMO-999';

-- 2. Log tablosuna bakalým.
SELECT TOP 1 * FROM Logs WHERE Action = 'FLIGHT_COMPLETED' ORDER BY LogID DESC;
-- Beklenen Sonuç (Details): "Flight DEMO-999 has landed."


-- ======================================================================
-- AÞAMA 5: TEMÝZLÝK VE SIFIRLAMA (KESÝN SONUÇ)
-- ======================================================================

-- 1. Demo Uçuþlarý ve Baðlý Biletleri Sil
-- (Önce biletleri silmek zorundayýz çünkü FlightID ile baðlýlar)
DELETE FROM Bookings 
WHERE FlightID IN (SELECT FlightID FROM Flights WHERE FlightCode IN ('DEMO-999', 'YENI-001'));

DELETE FROM Flights 
WHERE FlightCode IN ('DEMO-999', 'YENI-001');

-- 2. Demo Kullanýcýsýný Sil (Register testinden gelen)
DELETE FROM Users 
WHERE Username = 'DemoUser';

-- 3. Demo Sýrasýnda Oluþan Loglarý Sil
-- ('Ýptal' ve 'Uçak Ýndi' loglarýnýn hepsini temizle)
DELETE FROM Logs 
WHERE Details LIKE '%Demo%'      -- Demo uçuþ/yolcu loglarý
   OR Details LIKE '%YENI-001%'; -- Yeni uçuþ loglarý



