"""Realistic Synthetic Maintenance Dataset Generator for FacilityMind AI.

Generates 260+ authentic facility and campus maintenance records across multiple
equipment classes, buildings, failure modes, root causes, costs, and repair steps.
"""

import csv
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

random.seed(42)

EQUIPMENT_PROFILES = [
    {
        "type": "Air Conditioner",
        "id_prefix": "AC",
        "locations": [
            "Computer Lab 1", "Computer Lab 2", "Computer Lab 3",
            "Server Room A", "Admin Block - Room 102", "Library 2nd Floor",
            "Seminar Hall", "Faculty Lounge", "Chemistry Lab", "Dean Office"
        ],
        "scenarios": [
            {
                "complaint": "AC is not cooling properly and is making a loud rattling noise.",
                "symptoms": "Insufficient cooling, abnormal rattling sound from indoor unit, low airflow",
                "diagnosis": "Blower fan motor bearing wear and dust accumulation on evaporator coil",
                "root_cause": "Restricted airflow due to heavy dust accumulation and fan motor bearing degradation",
                "recommended_fix": "Clean indoor evaporator coil, inspect blower fan assembly, lubricate/replace bearings",
                "cost_min": 1500, "cost_max": 3200, "time_min": 1.5, "time_max": 2.5,
                "urgency": "Medium", "technician": "HVAC Specialist",
                "notes": "Coil cleaned with chemical wash, blower fan aligned and balanced. Cooling restored to 18°C."
            },
            {
                "complaint": "AC tripping the circuit breaker immediately after turning on compressor.",
                "symptoms": "Power trip on startup, compressor buzzing sound, no cold air",
                "diagnosis": "Compressor run capacitor blown and high starting current",
                "root_cause": "Degraded 45uF starting capacitor causing compressor rotor lock and breaker trip",
                "recommended_fix": "Replace dual run/start capacitor (45+5 uF) and test compressor winding resistance",
                "cost_min": 1200, "cost_max": 2500, "time_min": 1.0, "time_max": 1.5,
                "urgency": "High", "technician": "HVAC Specialist",
                "notes": "Capacitor replaced. Startup current measured at 9.2A (within safe limit)."
            },
            {
                "complaint": "Water leaking continuously from the indoor split AC unit inside lab.",
                "symptoms": "Water dripping down classroom wall, ice forming on indoor coil",
                "diagnosis": "Clogged condensate drain pipe and dirty filter mesh",
                "root_cause": "Algae and dust blockage in drain tray outlet causing overflow",
                "recommended_fix": "Clear condensate drain line with nitrogen blow, clean drain pan and filters",
                "cost_min": 800, "cost_max": 1500, "time_min": 0.8, "time_max": 1.2,
                "urgency": "Medium", "technician": "AC Technician",
                "notes": "Flushed drain pipe. Water drain slope verified with 2L flush test."
            },
            {
                "complaint": "AC blowing warm air, outdoor unit fan running but compressor silent.",
                "symptoms": "Warm air discharge, outdoor condenser fan active, no cooling effect",
                "diagnosis": "Refrigerant R-410A low pressure leak at flare nut connection",
                "root_cause": "Vibration-induced micro-crack in suction line flare joint resulting in gas leakage",
                "recommended_fix": "Perform nitrogen pressure leak test, re-flare joint, vacuum system and recharge R-410A",
                "cost_min": 3500, "cost_max": 5800, "time_min": 2.5, "time_max": 4.0,
                "urgency": "High", "technician": "Senior HVAC Technician",
                "notes": "Leak sealed at flare connection. Gas charged to 125 PSI. Delta-T across coil is 14°C."
            },
            {
                "complaint": "AC display showing error code E4 and shutting down within 5 minutes.",
                "symptoms": "Error code E4 on panel, unexpected thermal shutdown, intermittent cooling",
                "diagnosis": "Room ambient temperature sensor open circuit / resistance drift",
                "root_cause": "Corroded NTC thermistor sensor lead due to ambient humidity",
                "recommended_fix": "Replace 10k NTC copper coil and ambient temperature thermistor harness",
                "cost_min": 900, "cost_max": 1800, "time_min": 0.5, "time_max": 1.0,
                "urgency": "Low", "technician": "AC Technician",
                "notes": "New NTC sensor calibrated and sealed with heat shrink."
            }
        ]
    },
    {
        "type": "Diesel Generator",
        "id_prefix": "DG",
        "locations": ["Power Substation Yard", "Science Block Basement", "Hostel Block C Yard", "Hospital Backup Yard"],
        "scenarios": [
            {
                "complaint": "Diesel Generator fails to crank or start during main grid power outage.",
                "symptoms": "Clicking starter solenoid sound, instrument cluster dimming, engine not rotating",
                "diagnosis": "Lead-acid starter battery pack deep discharge and terminal sulfation",
                "root_cause": "Faulty float trickle battery charger failing to maintain 24V DC auxiliary bus",
                "recommended_fix": "Clean battery terminals, replace battery charger unit, jump-start and load-test battery bank",
                "cost_min": 4500, "cost_max": 8500, "time_min": 1.5, "time_max": 3.0,
                "urgency": "Critical", "technician": "Power Systems Engineer",
                "notes": "Battery bank reconditioned. New 24V smart float charger installed. Cranking voltage tested at 22.8V."
            },
            {
                "complaint": "Generator starting but shutting down after 30 seconds with Over-Frequency alarm.",
                "symptoms": "Engine hunting/surging, erratic RPM, automatic trip on governing fault",
                "diagnosis": "Mechanical governor linkage sticking and fuel injection pump air lock",
                "root_cause": "Contaminated diesel with particulate buildup in primary fuel filter and sticking governor spring",
                "recommended_fix": "Bleed fuel line, replace primary/secondary fuel filters, lubricate actuator linkage",
                "cost_min": 3200, "cost_max": 6500, "time_min": 2.0, "time_max": 3.5,
                "urgency": "High", "technician": "Diesel Mechanic",
                "notes": "Fuel filters replaced. Governor response tested at 50Hz under 60% step load."
            },
            {
                "complaint": "High coolant temperature alarm triggering within 10 minutes of full load running.",
                "symptoms": "Coolant temperature exceeding 98°C, radiator fan belt loose, coolant level dropping",
                "diagnosis": "Radiator fin clogging and slipping v-belt drive on water pump",
                "root_cause": "Dry dust accumulation in radiator core and worn tensioner pulley",
                "recommended_fix": "High-pressure air clean radiator fins, replace tensioner and v-belt, top up ethylene glycol coolant",
                "cost_min": 2800, "cost_max": 5200, "time_min": 1.5, "time_max": 2.5,
                "urgency": "High", "technician": "Mechanical Technician",
                "notes": "Radiator backwashed. Belt tension set to spec. Operating temp stable at 84°C under full load."
            }
        ]
    },
    {
        "type": "Elevator",
        "id_prefix": "LIFT",
        "locations": ["Academic Block A - Core", "Admin Tower", "Hostel Block 1", "Library Central", "Hospital Wing West"],
        "scenarios": [
            {
                "complaint": "Elevator doors repeatedly closing and reopening without passenger obstruction.",
                "symptoms": "Door cycle looping 4-5 times at Floor 2, door motor straining, buzzer sounding",
                "diagnosis": "Infrared door safety light curtain sensor misalignment and optical lens smudge",
                "root_cause": "Dust coating on lower infrared emitter diodes causing false beam interruption trigger",
                "recommended_fix": "Clean optical lenses, align transmitter and receiver strips, calibrate sensitivity",
                "cost_min": 1200, "cost_max": 2800, "time_min": 1.0, "time_max": 2.0,
                "urgency": "High", "technician": "Elevator Specialist",
                "notes": "Photocell curtain realigned and tested across all 128 beams."
            },
            {
                "complaint": "Elevator car making grinding sound and vibrating heavily during descent.",
                "symptoms": "Audible metal screeching, noticeable shuddering between Floors 3 and 4",
                "diagnosis": "Guide rail lubrication depletion and guide shoe roller wear",
                "root_cause": "Empty automatic oil lubricator cup and worn nylon guide shoe liner",
                "recommended_fix": "Replace guide shoe inserts, clean rail track, refill ISO VG 68 guide rail oil",
                "cost_min": 4000, "cost_max": 7500, "time_min": 2.5, "time_max": 4.0,
                "urgency": "High", "technician": "Senior Lift Engineer",
                "notes": "Replaced four guide shoe liners. Ride quality index tested smooth."
            },
            {
                "complaint": "Elevator stopping 2 inches below floor level at Ground Floor.",
                "symptoms": "Floor leveling discrepancy, trip hazard step, floor position reset required",
                "diagnosis": "Magnetic floor vane reader sensor bracket loose",
                "root_cause": "Loose mounting bolt on shaft leveling sensor causing delayed trigger signal",
                "recommended_fix": "Tighten and recalibrate floor leveling magnets and shaft position encoder",
                "cost_min": 1800, "cost_max": 3500, "time_min": 1.5, "time_max": 2.5,
                "urgency": "Critical", "technician": "Elevator Specialist",
                "notes": "Sensor repositioned with threadlocker. Leveling precision ±3mm achieved."
            }
        ]
    },
    {
        "type": "Water Pump",
        "id_prefix": "WP",
        "locations": ["Main Overhead Tank Sub-station", "Hostel Water Treatment Plant", "Garden Irrigation Hub", "Cafeteria Utility Area"],
        "scenarios": [
            {
                "complaint": "Water pump running continuously but delivering very low water pressure to top floors.",
                "symptoms": "Pump motor humming loudly, zero pressure gauge reading, air in pipeline",
                "diagnosis": "Suction foot valve stuck partially open and suction line priming lost",
                "root_cause": "Debris lodged in brass foot valve disc preventing positive prime holding",
                "recommended_fix": "Dismantle foot valve, clear silt debris, re-prime suction manifold and replace gasket",
                "cost_min": 1500, "cost_max": 3000, "time_min": 1.5, "time_max": 2.5,
                "urgency": "High", "technician": "Plumber & Pump Specialist",
                "notes": "Foot valve replaced with stainless steel mesh strainer. Priming restored."
            },
            {
                "complaint": "Water leaking heavily from pump shaft seal and motor tripping on thermal relay.",
                "symptoms": "Water puddle around pump base, motor casing hot to touch, breaker tripping",
                "diagnosis": "Mechanical shaft seal face cracked and motor bearing water ingress",
                "root_cause": "Dry running of pump causing ceramic-carbon seal face thermal shock",
                "recommended_fix": "Replace mechanical ceramic seal, repack shaft gland, test motor dry-run sensor",
                "cost_min": 2800, "cost_max": 4800, "time_min": 2.0, "time_max": 3.5,
                "urgency": "High", "technician": "Pump Technician",
                "notes": "Replaced mechanical seal and fitted dry-run float switch protector."
            }
        ]
    },
    {
        "type": "Classroom Projector",
        "id_prefix": "PRJ",
        "locations": ["Lecture Hall 101", "Lecture Hall 204", "Seminar Room B", "Auditorium Main", "Conference Room 3"],
        "scenarios": [
            {
                "complaint": "Projector turning on for 2 minutes then shutting down with blinking red Temp light.",
                "symptoms": "Rapid shutdown, red Temp warning LED, loud exhaust fan whining",
                "diagnosis": "Thermal sensor cutoff due to blocked intake air filter and dust on fan blades",
                "root_cause": "Dust accumulation clogging intake sponge filter preventing heat dissipation from lamp module",
                "recommended_fix": "Deep clean air filter sponge, blow out optical engine compartment, inspect fan RPM",
                "cost_min": 600, "cost_max": 1400, "time_min": 0.5, "time_max": 1.0,
                "urgency": "Medium", "technician": "AV Technician",
                "notes": "Filter washed and dried. Thermal sensor readings normalized."
            },
            {
                "complaint": "Projector displays 'No Signal' despite HDMI cable connected securely to laptop.",
                "symptoms": "Blue screen standby, HDMI source unacknowledged, cable pins loose",
                "diagnosis": "Damaged HDMI wall plate receptacle and cracked internal solder trace",
                "root_cause": "Repeated mechanical tugging on wall HDMI port causing physical pin fracture",
                "recommended_fix": "Replace wall plate HDMI 2.0 female-female connector module and patch cord",
                "cost_min": 800, "cost_max": 1600, "time_min": 0.5, "time_max": 1.0,
                "urgency": "Medium", "technician": "AV Technician",
                "notes": "Replaced wall socket module with reinforced metal pass-through."
            },
            {
                "complaint": "Projector image shows severe yellow discoloration and flickering color band.",
                "symptoms": "Distorted color matrix, flickering tint, faint grinding sound from optical chamber",
                "diagnosis": "DLP color wheel indexing sensor dirty / motor bearing seizure",
                "root_cause": "Dust layer on color wheel optical optocoupler sensor disc",
                "recommended_fix": "Clean optical color wheel sensor with isopropanol and realign optical path",
                "cost_min": 1800, "cost_max": 3800, "time_min": 1.5, "time_max": 2.5,
                "urgency": "Medium", "technician": "Senior AV Specialist",
                "notes": "Color wheel cleaned. RGB calibration completed with test pattern."
            }
        ]
    },
    {
        "type": "UPS System",
        "id_prefix": "UPS",
        "locations": ["Main Datacenter", "Biotech Lab Annex", "Exam Control Room", "Robotics Lab", "Hospital ICU Utility"],
        "scenarios": [
            {
                "complaint": "UPS constantly beeping with 'Battery Weak / Replace' indicator illuminated.",
                "symptoms": "Audible alert every 5 seconds, backup time dropped from 30 mins to 20 seconds",
                "diagnosis": "Sulfated 12V 42Ah SMF batteries with high internal impedance",
                "root_cause": "End of electrochemical battery service life (3+ years) and high operating ambient temperature",
                "recommended_fix": "Perform battery conductance test, replace weak battery block, calibrate float voltage",
                "cost_min": 6000, "cost_max": 14000, "time_min": 1.5, "time_max": 3.0,
                "urgency": "High", "technician": "Power Electronics Technician",
                "notes": "4 dead cells in 16-battery string replaced. Battery bank autonomy load-tested to 25 minutes."
            },
            {
                "complaint": "UPS switching automatically to Static Bypass mode with Overload error.",
                "symptoms": "Bypass LED active, inverter offline, cooling fans operating at maximum RPM",
                "diagnosis": "Inverter DC-AC bridge heat-sink thermal sensor triggering due to fan failure",
                "root_cause": "Exhaust fan 1 seized up with dust ball causing IGBT heatsink to reach 85°C",
                "recommended_fix": "Replace 120mm 24V DC ball bearing exhaust fan, clean heatsink, reset bypass alarm",
                "cost_min": 1400, "cost_max": 2800, "time_min": 1.0, "time_max": 1.5,
                "urgency": "High", "technician": "UPS Engineer",
                "notes": "Replaced cooling fans. UPS transferred back to online inverter mode."
            }
        ]
    },
    {
        "type": "RO Water Purifier",
        "id_prefix": "RO",
        "locations": ["Student Mess Floor 1", "Staff Cafeteria", "Sports Complex", "Library Water Station", "Hostel Block B"],
        "scenarios": [
            {
                "complaint": "Water purifier flow rate has dropped to a trickle, taking 10 mins to fill one bottle.",
                "symptoms": "Very slow permeate flow, high reject water flow ratio, booster pump running continuously",
                "diagnosis": "Sediment pre-filter and activated carbon block choked with silt",
                "root_cause": "High turbidity in incoming municipal water supply over past 2 weeks",
                "recommended_fix": "Replace 5-micron spun polypropylene pre-filter and 10-inch CTO carbon block",
                "cost_min": 900, "cost_max": 1800, "time_min": 0.5, "time_max": 1.0,
                "urgency": "Medium", "technician": "Water Plant Technician",
                "notes": "Pre-filters replaced. Flow rate restored to 50 LPH at 60 PSI."
            },
            {
                "complaint": "Drinking water tastes salty and TDS meter reading above 450 ppm (normal < 100).",
                "symptoms": "Salty/mineral taste, elevated TDS reading, membrane pressure high",
                "diagnosis": "Thin Film Composite (TFC) RO membrane scaling and salt passage leakage",
                "root_cause": "Calcium carbonate scale buildup rupturing membrane layers due to antiscalant dosing lapse",
                "recommended_fix": "Sanitize filter housings and replace 75 GPD Dow Filmtec RO membrane",
                "cost_min": 2500, "cost_max": 4200, "time_min": 1.0, "time_max": 2.0,
                "urgency": "High", "technician": "Water Plant Specialist",
                "notes": "New RO membrane installed. Output TDS measured at 62 ppm."
            }
        ]
    },
    {
        "type": "Electrical Panel",
        "id_prefix": "EP",
        "locations": ["Engineering Block LT Room", "Auditorium Main Switchboard", "Canteen Feeder Panel", "Hostel Main DB"],
        "scenarios": [
            {
                "complaint": "Smell of burning insulation and humming sound coming from main electrical distribution board.",
                "symptoms": "Pungent ozone/burning plastic smell, audible 50Hz arcing hum, warm panel exterior",
                "diagnosis": "Loose terminal lug on R-phase 200A MCCB busbar connection causing thermal hot-spot",
                "root_cause": "Thermal cycling loosening bolted terminal connection leading to high contact resistance",
                "recommended_fix": "De-energize panel, re-crimp burned lug, torque all busbar connections, apply torque seal",
                "cost_min": 2200, "cost_max": 4500, "time_min": 1.5, "time_max": 3.0,
                "urgency": "Critical", "technician": "Senior Electrical Engineer",
                "notes": "Thermographic scan verified: Hot spot reduced from 112°C to 38°C under load."
            }
        ]
    },
    {
        "type": "CCTV Camera",
        "id_prefix": "CAM",
        "locations": ["Campus Main Gate", "Library Entrance", "Parking Lot North", "Hostel Perimeter West", "Corridor Block 3"],
        "scenarios": [
            {
                "complaint": "Camera video feed showing black screen at night and washed-out glare during day.",
                "symptoms": "Night vision infrared failed, pinkish hue in daylight, camera online on network",
                "diagnosis": "IR cut filter mechanical solenoid stuck in day position",
                "root_cause": "Moisture ingress jamming delicate mechanical filter shift shutter",
                "recommended_fix": "Disassemble camera housing, replace silica desiccant, clean filter solenoid track",
                "cost_min": 800, "cost_max": 1800, "time_min": 1.0, "time_max": 1.5,
                "urgency": "Low", "technician": "Security Systems Technician",
                "notes": "Resealed camera housing with IP67 silicone gasket. Day/night switching verified."
            }
        ]
    },
    {
        "type": "Network Switch",
        "id_prefix": "SW",
        "locations": ["IT Rack - Floor 2", "Library Data Center", "Admin Switch Closet", "Hostel Wi-Fi Distribution"],
        "scenarios": [
            {
                "complaint": "Entire department experiencing intermittent Wi-Fi drops and packet loss.",
                "symptoms": "High latency ping spikes, PoE access points rebooting, switch status LED amber",
                "diagnosis": "PoE power supply unit over-temperature shutdown due to internal fan dust lock",
                "root_cause": "Blocked exhaust vent on 48-port PoE switch causing PSU thermal protection trip",
                "recommended_fix": "Clean rack dust filters, replace switch chassis fan, rebalance PoE power budget",
                "cost_min": 1500, "cost_max": 3000, "time_min": 1.0, "time_max": 2.0,
                "urgency": "High", "technician": "Network Administrator",
                "notes": "Switch firmware updated and internal temperature dropped from 68°C to 41°C."
            }
        ]
    }
]


def generate_records(target_count: int = 260) -> list[dict]:
    """Generate a balanced list of synthetic maintenance records."""
    records = []
    current_date = datetime.now(timezone.utc)

    case_id = 1001

    while len(records) < target_count:
        for profile in EQUIPMENT_PROFILES:
            if len(records) >= target_count:
                break

            eq_type = profile["type"]
            eq_prefix = profile["id_prefix"]
            
            for scenario in profile["scenarios"]:
                if len(records) >= target_count:
                    break

                # Create 2-4 realistic variations per scenario across different locations/times
                num_variations = random.randint(2, 4)
                for _ in range(num_variations):
                    if len(records) >= target_count:
                        break

                    location = random.choice(profile["locations"])
                    eq_num = random.randint(1, 45)
                    eq_id = f"{eq_prefix}-{eq_num:03d}"

                    # Random date within past 18 months
                    days_ago = random.randint(3, 540)
                    record_date = current_date - timedelta(days=days_ago)

                    # Random slight variance in cost and duration
                    cost = random.randint(scenario["cost_min"], scenario["cost_max"])
                    # Round cost to nearest 50
                    cost = (cost // 50) * 50

                    repair_time = round(random.uniform(scenario["time_min"], scenario["time_max"]), 1)

                    status = random.choices(
                        ["Resolved", "Verified & Closed", "Preventive Maintenance Completed"],
                        weights=[0.75, 0.20, 0.05]
                    )[0]

                    record = {
                        "id": case_id,
                        "equipment_type": eq_type,
                        "equipment_id": eq_id,
                        "location": location,
                        "complaint": scenario["complaint"],
                        "symptoms": scenario["symptoms"],
                        "diagnosis": scenario["diagnosis"],
                        "root_cause": scenario["root_cause"],
                        "recommended_fix": scenario["recommended_fix"],
                        "estimated_cost": cost,
                        "repair_time": repair_time,
                        "urgency": scenario["urgency"],
                        "technician_type": scenario["technician"],
                        "date": record_date.strftime("%Y-%m-%d"),
                        "technician_notes": scenario["notes"],
                        "status": status,
                    }
                    records.append(record)
                    case_id += 1

    return records


def save_to_csv(records: list[dict], output_path: Path) -> None:
    """Save records to CSV file."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fields = [
        "id", "equipment_type", "equipment_id", "location", "complaint",
        "symptoms", "diagnosis", "root_cause", "recommended_fix",
        "estimated_cost", "repair_time", "urgency", "technician_type",
        "date", "technician_notes", "status"
    ]
    with open(output_path, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(records)
    print(f"[SUCCESS] Generated {len(records)} maintenance records -> {output_path}")


if __name__ == "__main__":
    out_file = Path(__file__).resolve().parent / "maintenance_records.csv"
    generated = generate_records(265)
    save_to_csv(generated, out_file)
