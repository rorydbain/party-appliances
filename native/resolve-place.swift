import Foundation
import CoreLocation
import Darwin
struct Coordinates: Decodable { let latitude: Double; let longitude: Double }
struct Place: Encodable { let placeName: String; let provider: String }
func finish(_ value: Place?, _ status: Int32 = 0) -> Never {
    if let value = value, let json = try? JSONEncoder().encode(value) { FileHandle.standardOutput.write(json) }
    else { FileHandle.standardOutput.write(Data("{}".utf8)) }
    exit(status)
}
guard let line = readLine(), let bytes = line.data(using: .utf8),
      let point = try? JSONDecoder().decode(Coordinates.self, from: bytes),
      CLLocationCoordinate2DIsValid(CLLocationCoordinate2D(latitude: point.latitude, longitude: point.longitude)) else { finish(nil, 2) }
// Resolve the photo's coordinates. Never request the Mac's location.
let geocoder = CLGeocoder()
geocoder.reverseGeocodeLocation(CLLocation(latitude: point.latitude, longitude: point.longitude), preferredLocale: Locale(identifier: "en_GB")) { places, error in
    guard error == nil, let place = places?.first else { finish(nil, 1) }
    let area = place.locality ?? place.subAdministrativeArea ?? place.administrativeArea ?? place.inlandWater ?? place.ocean
    var parts: [String] = []
    for part in [area, place.country].compactMap({ $0 }) {
        let name = part.trimmingCharacters(in: .whitespacesAndNewlines)
        if !name.isEmpty && !parts.contains(name) { parts.append(name) }
    }
    guard !parts.isEmpty else { finish(nil, 1) }
    finish(Place(placeName: parts.joined(separator: ", "), provider: "Apple"))
}
DispatchQueue.main.asyncAfter(deadline: .now() + 18) { geocoder.cancelGeocode(); finish(nil, 1) }
RunLoop.main.run()
