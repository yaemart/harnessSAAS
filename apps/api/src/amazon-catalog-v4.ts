export interface AmazonCatalogNode {
    code: string;
    name: string;
    children?: AmazonCatalogNode[];
}

export const AMAZON_US_CATALOG: AmazonCatalogNode[] = [
    {
        "code": "ELECTRONICS",
        "name": "Electronics",
        "children": [
            {
                "code": "ELECTRONICS_HEADPHONES",
                "name": "Headphones",
                "children": [
                    {
                        "code": "ELECTRONICS_HEADPHONES_EARBUDS",
                        "name": "Earbuds"
                    },
                    {
                        "code": "ELECTRONICS_HEADPHONES_OVER_EAR",
                        "name": "Over-Ear"
                    },
                    {
                        "code": "ELECTRONICS_HEADPHONES_ON_EAR",
                        "name": "On-Ear"
                    },
                    {
                        "code": "ELECTRONICS_HEADPHONES_WIRELESS",
                        "name": "Wireless"
                    },
                    {
                        "code": "ELECTRONICS_HEADPHONES_NOISE_CANCELLING",
                        "name": "Noise Cancelling"
                    },
                    {
                        "code": "ELECTRONICS_HEADPHONES_SPORTS",
                        "name": "Sports"
                    },
                    {
                        "code": "ELECTRONICS_HEADPHONES_GAMING",
                        "name": "Gaming"
                    },
                    {
                        "code": "ELECTRONICS_HEADPHONES_ACCESSORIES",
                        "name": "Accessories"
                    }
                ]
            },
            {
                "code": "ELECTRONICS_HOME_AUDIO",
                "name": "Home Audio",
                "children": [
                    {
                        "code": "ELECTRONICS_HOME_AUDIO_SPEAKERS",
                        "name": "Speakers"
                    },
                    {
                        "code": "ELECTRONICS_HOME_AUDIO_SOUNDBARS",
                        "name": "Soundbars"
                    },
                    {
                        "code": "ELECTRONICS_HOME_AUDIO_RECEIVERS",
                        "name": "Receivers"
                    },
                    {
                        "code": "ELECTRONICS_HOME_AUDIO_TURNTABLES",
                        "name": "Turntables"
                    },
                    {
                        "code": "ELECTRONICS_HOME_AUDIO_HOME_THEATER",
                        "name": "Home Theater"
                    },
                    {
                        "code": "ELECTRONICS_HOME_AUDIO_COMPACT_STEREOS",
                        "name": "Compact Stereos"
                    },
                    {
                        "code": "ELECTRONICS_HOME_AUDIO_WIRELESS_MULTIROOM",
                        "name": "Wireless Multiroom"
                    }
                ]
            },
            {
                "code": "ELECTRONICS_COMPUTERS",
                "name": "Computers",
                "children": [
                    {
                        "code": "ELECTRONICS_COMPUTERS_LAPTOPS",
                        "name": "Laptops"
                    },
                    {
                        "code": "ELECTRONICS_COMPUTERS_DESKTOPS",
                        "name": "Desktops"
                    },
                    {
                        "code": "ELECTRONICS_COMPUTERS_MONITORS",
                        "name": "Monitors"
                    },
                    {
                        "code": "ELECTRONICS_COMPUTERS_NETWORKING",
                        "name": "Networking"
                    },
                    {
                        "code": "ELECTRONICS_COMPUTERS_PRINTERS",
                        "name": "Printers"
                    },
                    {
                        "code": "ELECTRONICS_COMPUTERS_DRIVES_AND_STORAGE",
                        "name": "Drives & Storage"
                    },
                    {
                        "code": "ELECTRONICS_COMPUTERS_TABLETS",
                        "name": "Tablets"
                    },
                    {
                        "code": "ELECTRONICS_COMPUTERS_COMPUTER_ACCESSORIES",
                        "name": "Computer Accessories"
                    },
                    {
                        "code": "ELECTRONICS_COMPUTERS_COMPONENTS",
                        "name": "Components"
                    }
                ]
            },
            {
                "code": "ELECTRONICS_CAMERA",
                "name": "Camera & Photo",
                "children": [
                    {
                        "code": "ELECTRONICS_CAMERA_DIGITAL_CAMERAS",
                        "name": "Digital Cameras"
                    },
                    {
                        "code": "ELECTRONICS_CAMERA_LENSES",
                        "name": "Lenses"
                    },
                    {
                        "code": "ELECTRONICS_CAMERA_TRIPODS",
                        "name": "Tripods"
                    },
                    {
                        "code": "ELECTRONICS_CAMERA_DRONES",
                        "name": "Drones"
                    },
                    {
                        "code": "ELECTRONICS_CAMERA_VIDEO_CAMERAS",
                        "name": "Video Cameras"
                    },
                    {
                        "code": "ELECTRONICS_CAMERA_SURVEILLANCE",
                        "name": "Surveillance"
                    },
                    {
                        "code": "ELECTRONICS_CAMERA_LIGHTING_AND_STUDIO",
                        "name": "Lighting & Studio"
                    },
                    {
                        "code": "ELECTRONICS_CAMERA_BINOCULARS",
                        "name": "Binoculars"
                    }
                ]
            },
            {
                "code": "ELECTRONICS_WEARABLES",
                "name": "Wearable Technology",
                "children": [
                    {
                        "code": "ELECTRONICS_WEARABLES_SMARTWATCHES",
                        "name": "Smartwatches"
                    },
                    {
                        "code": "ELECTRONICS_WEARABLES_FITNESS_TRACKERS",
                        "name": "Fitness Trackers"
                    },
                    {
                        "code": "ELECTRONICS_WEARABLES_VR_HEADSETS",
                        "name": "VR Headsets"
                    },
                    {
                        "code": "ELECTRONICS_WEARABLES_AR_GLASSES",
                        "name": "AR Glasses"
                    },
                    {
                        "code": "ELECTRONICS_WEARABLES_SMART_RINGS",
                        "name": "Smart Rings"
                    }
                ]
            },
            {
                "code": "ELECTRONICS_SMART_HOME",
                "name": "Smart Home",
                "children": [
                    {
                        "code": "ELECTRONICS_SMART_HOME_SMART_LIGHTING",
                        "name": "Smart Lighting"
                    },
                    {
                        "code": "ELECTRONICS_SMART_HOME_SECURITY_CAMERAS",
                        "name": "Security Cameras"
                    },
                    {
                        "code": "ELECTRONICS_SMART_HOME_SMART_PLUGS",
                        "name": "Smart Plugs"
                    },
                    {
                        "code": "ELECTRONICS_SMART_HOME_THERMOSTATS",
                        "name": "Thermostats"
                    },
                    {
                        "code": "ELECTRONICS_SMART_HOME_LOCKS",
                        "name": "Locks"
                    },
                    {
                        "code": "ELECTRONICS_SMART_HOME_VOICE_ASSISTANTS",
                        "name": "Voice Assistants"
                    },
                    {
                        "code": "ELECTRONICS_SMART_HOME_SENSORS",
                        "name": "Sensors"
                    }
                ]
            },
            {
                "code": "ELECTRONICS_TV_VIDEO",
                "name": "Television & Video",
                "children": [
                    {
                        "code": "ELECTRONICS_TV_VIDEO_TELEVISIONS",
                        "name": "Televisions"
                    },
                    {
                        "code": "ELECTRONICS_TV_VIDEO_STREAMING_PLAYERS",
                        "name": "Streaming Players"
                    },
                    {
                        "code": "ELECTRONICS_TV_VIDEO_DVD_AND_BLU_RAY",
                        "name": "DVD & Blu-ray"
                    },
                    {
                        "code": "ELECTRONICS_TV_VIDEO_PROJECTORS",
                        "name": "Projectors"
                    },
                    {
                        "code": "ELECTRONICS_TV_VIDEO_TV_MOUNTS",
                        "name": "TV Mounts"
                    }
                ]
            }
        ]
    },
    {
        "code": "HOME_KITCHEN",
        "name": "Home & Kitchen",
        "children": [
            {
                "code": "HOME_KITCHEN_KITCHEN_DINING",
                "name": "Kitchen & Dining",
                "children": [
                    {
                        "code": "HOME_KITCHEN_KITCHEN_DINING_SMALL_APPLIANCES",
                        "name": "Small Appliances",
                        "children": [
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_SMALL_APPLIANCES_AIR_FRYERS",
                                "name": "Air Fryers"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_SMALL_APPLIANCES_COFFEE_MAKERS",
                                "name": "Coffee Makers"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_SMALL_APPLIANCES_ESPRESSO_MACHINES",
                                "name": "Espresso Machines"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_SMALL_APPLIANCES_SLOW_COOKERS",
                                "name": "Slow Cookers"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_SMALL_APPLIANCES_PRESSURE_COOKERS",
                                "name": "Pressure Cookers"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_SMALL_APPLIANCES_RICE_COOKERS",
                                "name": "Rice Cookers"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_SMALL_APPLIANCES_FOOD_STEAMERS",
                                "name": "Food Steamers"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_SMALL_APPLIANCES_EGG_COOKERS",
                                "name": "Egg Cookers"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_SMALL_APPLIANCES_BREAD_MACHINES",
                                "name": "Bread Machines"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_SMALL_APPLIANCES_ICE_MAKERS",
                                "name": "Ice Makers"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_SMALL_APPLIANCES_DEEP_FRYERS",
                                "name": "Deep Fryers"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_SMALL_APPLIANCES_BLENDERS",
                                "name": "Blenders"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_SMALL_APPLIANCES_FOOD_PROCESSORS",
                                "name": "Food Processors"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_SMALL_APPLIANCES_JUICERS",
                                "name": "Juicers"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_SMALL_APPLIANCES_TOASTERS",
                                "name": "Toasters"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_SMALL_APPLIANCES_TOASTER_OVENS",
                                "name": "Toaster Ovens"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_SMALL_APPLIANCES_CONVECTION_OVENS",
                                "name": "Convection Ovens"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_SMALL_APPLIANCES_MIXERS",
                                "name": "Mixers"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_SMALL_APPLIANCES_WAFFLE_MAKERS",
                                "name": "Waffle Makers"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_SMALL_APPLIANCES_GRILLS_AND_GRIDDLES",
                                "name": "Grills & Griddles"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_SMALL_APPLIANCES_KETTLES",
                                "name": "Kettles"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_SMALL_APPLIANCES_SODA_MAKERS",
                                "name": "Soda Makers"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_SMALL_APPLIANCES_VACUUM_SEALERS",
                                "name": "Vacuum Sealers"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_SMALL_APPLIANCES_DEHYDRATORS",
                                "name": "Dehydrators"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_SMALL_APPLIANCES_FOOD_GRINDERS",
                                "name": "Food Grinders"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_SMALL_APPLIANCES_PASTA_MAKERS",
                                "name": "Pasta Makers"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_SMALL_APPLIANCES_ICE_CREAM_MACHINES",
                                "name": "Ice Cream Machines"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_SMALL_APPLIANCES_MILK_FROTHERS",
                                "name": "Milk Frothers"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_SMALL_APPLIANCES_YOGURT_MAKERS",
                                "name": "Yogurt Makers"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_SMALL_APPLIANCES_ELECTRIC_SKILLETS",
                                "name": "Electric Skillets"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_SMALL_APPLIANCES_COTTON_CANDY_MACHINES",
                                "name": "Cotton Candy Machines"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_SMALL_APPLIANCES_POPCORN_MACHINES",
                                "name": "Popcorn Machines"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_SMALL_APPLIANCES_CHOCOLATE_FOUNTAINS",
                                "name": "Chocolate Fountains"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_SMALL_APPLIANCES_CONTACT_GRILLS",
                                "name": "Contact Grills"
                            }
                        ]
                    },
                    {
                        "code": "HOME_KITCHEN_KITCHEN_DINING_UTENSILS_GADGETS",
                        "name": "Kitchen Utensils & Gadgets",
                        "children": [
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_UTENSILS_GADGETS_CAN_OPENERS",
                                "name": "Can Openers"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_UTENSILS_GADGETS_ELECTRIC_CAN_OPENERS",
                                "name": "Electric Can Openers"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_UTENSILS_GADGETS_MANUAL_CAN_OPENERS",
                                "name": "Manual Can Openers"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_UTENSILS_GADGETS_MANDOLINES",
                                "name": "Mandolines"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_UTENSILS_GADGETS_SLICERS",
                                "name": "Slicers"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_UTENSILS_GADGETS_MEASURING_CUPS_AND_SPOONS",
                                "name": "Measuring Cups & Spoons"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_UTENSILS_GADGETS_KITCHEN_SCALES",
                                "name": "Kitchen Scales"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_UTENSILS_GADGETS_MEAT_THERMOMETERS",
                                "name": "Meat Thermometers"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_UTENSILS_GADGETS_OVEN_THERMOMETERS",
                                "name": "Oven Thermometers"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_UTENSILS_GADGETS_SPATULAS",
                                "name": "Spatulas"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_UTENSILS_GADGETS_TONGS",
                                "name": "Tongs"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_UTENSILS_GADGETS_WHISKS",
                                "name": "Whisks"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_UTENSILS_GADGETS_LADLES",
                                "name": "Ladles"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_UTENSILS_GADGETS_GRATERS",
                                "name": "Graters"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_UTENSILS_GADGETS_PEELERS",
                                "name": "Peelers"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_UTENSILS_GADGETS_COLANDERS",
                                "name": "Colanders"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_UTENSILS_GADGETS_STRAINERS",
                                "name": "Strainers"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_UTENSILS_GADGETS_GARLIC_PRESSES",
                                "name": "Garlic Presses"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_UTENSILS_GADGETS_POTATO_MASHERS",
                                "name": "Potato Mashers"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_UTENSILS_GADGETS_SALAD_SPINNERS",
                                "name": "Salad Spinners"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_UTENSILS_GADGETS_VEGETABLE_SPIRALIZERS",
                                "name": "Vegetable Spiralizers"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_UTENSILS_GADGETS_ICE_CREAM_SCOOPS",
                                "name": "Ice Cream Scoops"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_UTENSILS_GADGETS_PIZZA_CUTTERS",
                                "name": "Pizza Cutters"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_UTENSILS_GADGETS_ZESTERS",
                                "name": "Zesters"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_UTENSILS_GADGETS_NUT_CRACKERS",
                                "name": "Nut Crackers"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_UTENSILS_GADGETS_WINE_OPENERS",
                                "name": "Wine Openers"
                            }
                        ]
                    },
                    {
                        "code": "HOME_KITCHEN_KITCHEN_DINING_COOKWARE",
                        "name": "Cookware",
                        "children": [
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_COOKWARE_POTS_AND_PANS",
                                "name": "Pots & Pans"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_COOKWARE_SKILLETS",
                                "name": "Skillets"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_COOKWARE_WOKS",
                                "name": "Woks"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_COOKWARE_CAST_IRON",
                                "name": "Cast Iron"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_COOKWARE_DUTCH_OVENS",
                                "name": "Dutch Ovens"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_COOKWARE_BAKEWARE_SETS",
                                "name": "Bakeware Sets"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_COOKWARE_STEAMERS",
                                "name": "Steamers"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_COOKWARE_CASSEROLES",
                                "name": "Casseroles"
                            }
                        ]
                    },
                    {
                        "code": "HOME_KITCHEN_KITCHEN_DINING_STORAGE",
                        "name": "Kitchen Storage & Organization",
                        "children": [
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_STORAGE_FOOD_CONTAINERS",
                                "name": "Food Containers"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_STORAGE_PANTRY_STORAGE",
                                "name": "Pantry Storage"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_STORAGE_SPICE_RACKS",
                                "name": "Spice Racks"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_STORAGE_DISH_RACKS",
                                "name": "Dish Racks"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_STORAGE_LUNCH_BOXES",
                                "name": "Lunch Boxes"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_STORAGE_WINE_RACKS",
                                "name": "Wine Racks"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_STORAGE_FRUIT_BOWLS",
                                "name": "Fruit Bowls"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_STORAGE_BREAD_BOXES",
                                "name": "Bread Boxes"
                            }
                        ]
                    },
                    {
                        "code": "HOME_KITCHEN_KITCHEN_DINING_DINING",
                        "name": "Dining & Entertaining",
                        "children": [
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_DINING_DINNERWARE",
                                "name": "Dinnerware"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_DINING_GLASSWARE",
                                "name": "Glassware"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_DINING_FLATWARE",
                                "name": "Flatware"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_DINING_SERVEWARE",
                                "name": "Serveware"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_DINING_BAR_AND_WINE_TOOLS",
                                "name": "Bar & Wine Tools"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_DINING_TABLE_LINENS",
                                "name": "Table Linens"
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_DINING_NAPKIN_HOLDERS",
                                "name": "Napkin Holders"
                            }
                        ]
                    },
                    {
                        "code": "HOME_KITCHEN_KITCHEN_DINING_COFFEE_TEA_ESPRESSO",
                        "name": "Coffee, Tea & Espresso",
                        "children": [
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_COFFEE_TEA_ESPRESSO_COFFEE_GRINDERS",
                                "name": "Coffee Grinders",
                                "children": [
                                    {
                                        "code": "HOME_KITCHEN_KITCHEN_DINING_COFFEE_TEA_ESPRESSO_COFFEE_GRINDERS_ELECTRIC_BURR_GRINDERS",
                                        "name": "Electric Burr Grinders"
                                    },
                                    {
                                        "code": "HOME_KITCHEN_KITCHEN_DINING_COFFEE_TEA_ESPRESSO_COFFEE_GRINDERS_BLADE_GRINDERS",
                                        "name": "Blade Grinders"
                                    },
                                    {
                                        "code": "HOME_KITCHEN_KITCHEN_DINING_COFFEE_TEA_ESPRESSO_COFFEE_GRINDERS_MANUAL_GRINDERS",
                                        "name": "Manual Grinders"
                                    }
                                ]
                            },
                            {
                                "code": "HOME_KITCHEN_KITCHEN_DINING_COFFEE_TEA_ESPRESSO_ESPRESSO_MACHINES",
                                "name": "Espresso Machines",
                                "children": [
                                    {
                                        "code": "HOME_KITCHEN_KITCHEN_DINING_COFFEE_TEA_ESPRESSO_ESPRESSO_MACHINES_SEMI_AUTOMATIC",
                                        "name": "Semi-Automatic"
                                    },
                                    {
                                        "code": "HOME_KITCHEN_KITCHEN_DINING_COFFEE_TEA_ESPRESSO_ESPRESSO_MACHINES_SUPER_AUTOMATIC",
                                        "name": "Super-Automatic"
                                    },
                                    {
                                        "code": "HOME_KITCHEN_KITCHEN_DINING_COFFEE_TEA_ESPRESSO_ESPRESSO_MACHINES_MANUAL",
                                        "name": "Manual"
                                    },
                                    {
                                        "code": "HOME_KITCHEN_KITCHEN_DINING_COFFEE_TEA_ESPRESSO_ESPRESSO_MACHINES_PORTABLE",
                                        "name": "Portable"
                                    }
                                ]
                            }
                        ]
                    }
                ]
            },
            {
                "code": "HOME_KITCHEN_HOME_DECOR",
                "name": "Home Decor",
                "children": [
                    {
                        "code": "HOME_KITCHEN_HOME_DECOR_AREA_RUGS",
                        "name": "Area Rugs"
                    },
                    {
                        "code": "HOME_KITCHEN_HOME_DECOR_WALL_ART",
                        "name": "Wall Art"
                    },
                    {
                        "code": "HOME_KITCHEN_HOME_DECOR_MIRRORS",
                        "name": "Mirrors"
                    },
                    {
                        "code": "HOME_KITCHEN_HOME_DECOR_LIGHTING",
                        "name": "Lighting"
                    },
                    {
                        "code": "HOME_KITCHEN_HOME_DECOR_CLOCKS",
                        "name": "Clocks"
                    },
                    {
                        "code": "HOME_KITCHEN_HOME_DECOR_CANDLES",
                        "name": "Candles"
                    },
                    {
                        "code": "HOME_KITCHEN_HOME_DECOR_ARTIFICIAL_PLANTS",
                        "name": "Artificial Plants"
                    },
                    {
                        "code": "HOME_KITCHEN_HOME_DECOR_VASES",
                        "name": "Vases"
                    },
                    {
                        "code": "HOME_KITCHEN_HOME_DECOR_WINDOW_TREATMENTS",
                        "name": "Window Treatments"
                    }
                ]
            },
            {
                "code": "HOME_KITCHEN_BEDDING",
                "name": "Bedding",
                "children": [
                    {
                        "code": "HOME_KITCHEN_BEDDING_SHEETS",
                        "name": "Sheets"
                    },
                    {
                        "code": "HOME_KITCHEN_BEDDING_COMFORTERS",
                        "name": "Comforters"
                    },
                    {
                        "code": "HOME_KITCHEN_BEDDING_PILLOWS",
                        "name": "Pillows"
                    },
                    {
                        "code": "HOME_KITCHEN_BEDDING_BLANKETS",
                        "name": "Blankets"
                    },
                    {
                        "code": "HOME_KITCHEN_BEDDING_MATTRESS_PADS",
                        "name": "Mattress Pads"
                    },
                    {
                        "code": "HOME_KITCHEN_BEDDING_BED_SKIRTS",
                        "name": "Bed Skirts"
                    },
                    {
                        "code": "HOME_KITCHEN_BEDDING_DUVET_COVERS",
                        "name": "Duvet Covers"
                    }
                ]
            },
            {
                "code": "HOME_KITCHEN_FURNITURE",
                "name": "Furniture",
                "children": [
                    {
                        "code": "HOME_KITCHEN_FURNITURE_LIVING_ROOM",
                        "name": "Living Room"
                    },
                    {
                        "code": "HOME_KITCHEN_FURNITURE_BEDROOM",
                        "name": "Bedroom"
                    },
                    {
                        "code": "HOME_KITCHEN_FURNITURE_HOME_OFFICE",
                        "name": "Home Office"
                    },
                    {
                        "code": "HOME_KITCHEN_FURNITURE_KITCHEN_AND_DINING",
                        "name": "Kitchen & Dining"
                    },
                    {
                        "code": "HOME_KITCHEN_FURNITURE_ENTRYWAY",
                        "name": "Entryway"
                    },
                    {
                        "code": "HOME_KITCHEN_FURNITURE_KIDS_FURNITURE",
                        "name": "Kids' Furniture"
                    },
                    {
                        "code": "HOME_KITCHEN_FURNITURE_PATIO_FURNITURE",
                        "name": "Patio Furniture"
                    }
                ]
            },
            {
                "code": "HOME_KITCHEN_BATH",
                "name": "Bath",
                "children": [
                    {
                        "code": "HOME_KITCHEN_BATH_TOWELS",
                        "name": "Towels"
                    },
                    {
                        "code": "HOME_KITCHEN_BATH_BATH_RUGS",
                        "name": "Bath Rugs"
                    },
                    {
                        "code": "HOME_KITCHEN_BATH_SHOWER_CURTAINS",
                        "name": "Shower Curtains"
                    },
                    {
                        "code": "HOME_KITCHEN_BATH_BATHROOM_ACCESSORIES",
                        "name": "Bathroom Accessories"
                    },
                    {
                        "code": "HOME_KITCHEN_BATH_SCALES",
                        "name": "Scales"
                    }
                ]
            },
            {
                "code": "HOME_KITCHEN_CLEANING",
                "name": "Vacuum & Floor Care",
                "children": [
                    {
                        "code": "HOME_KITCHEN_CLEANING_VACUUMS",
                        "name": "Vacuums"
                    },
                    {
                        "code": "HOME_KITCHEN_CLEANING_STEAM_MOPS",
                        "name": "Steam Mops"
                    },
                    {
                        "code": "HOME_KITCHEN_CLEANING_BROOMS",
                        "name": "Brooms"
                    },
                    {
                        "code": "HOME_KITCHEN_CLEANING_CLEANING_SOLUTIONS",
                        "name": "Cleaning Solutions"
                    },
                    {
                        "code": "HOME_KITCHEN_CLEANING_TRASH_CANS",
                        "name": "Trash Cans"
                    }
                ]
            }
        ]
    },
    {
        "code": "BEAUTY",
        "name": "Beauty & Personal Care",
        "children": [
            {
                "code": "BEAUTY_SKIN_CARE",
                "name": "Skin Care",
                "children": [
                    {
                        "code": "BEAUTY_SKIN_CARE_FACE",
                        "name": "Face"
                    },
                    {
                        "code": "BEAUTY_SKIN_CARE_BODY",
                        "name": "Body"
                    },
                    {
                        "code": "BEAUTY_SKIN_CARE_SUNSCREEN",
                        "name": "Sunscreen"
                    },
                    {
                        "code": "BEAUTY_SKIN_CARE_ANTI_AGING",
                        "name": "Anti-Aging"
                    },
                    {
                        "code": "BEAUTY_SKIN_CARE_MOISTURIZERS",
                        "name": "Moisturizers"
                    },
                    {
                        "code": "BEAUTY_SKIN_CARE_CLEANSERS",
                        "name": "Cleansers"
                    },
                    {
                        "code": "BEAUTY_SKIN_CARE_MASKS",
                        "name": "Masks"
                    },
                    {
                        "code": "BEAUTY_SKIN_CARE_LIPS",
                        "name": "Lips"
                    }
                ]
            },
            {
                "code": "BEAUTY_HAIR_CARE",
                "name": "Hair Care",
                "children": [
                    {
                        "code": "BEAUTY_HAIR_CARE_SHAMPOO",
                        "name": "Shampoo"
                    },
                    {
                        "code": "BEAUTY_HAIR_CARE_CONDITIONER",
                        "name": "Conditioner"
                    },
                    {
                        "code": "BEAUTY_HAIR_CARE_STYLING_TOOLS",
                        "name": "Styling Tools"
                    },
                    {
                        "code": "BEAUTY_HAIR_CARE_DRYERS",
                        "name": "Dryers"
                    },
                    {
                        "code": "BEAUTY_HAIR_CARE_STRAIGHTENERS",
                        "name": "Straighteners"
                    },
                    {
                        "code": "BEAUTY_HAIR_CARE_COLOR",
                        "name": "Color"
                    },
                    {
                        "code": "BEAUTY_HAIR_CARE_TREATMENTS",
                        "name": "Treatments"
                    }
                ]
            },
            {
                "code": "BEAUTY_MAKEUP",
                "name": "Makeup",
                "children": [
                    {
                        "code": "BEAUTY_MAKEUP_EYES",
                        "name": "Eyes"
                    },
                    {
                        "code": "BEAUTY_MAKEUP_LIPS",
                        "name": "Lips"
                    },
                    {
                        "code": "BEAUTY_MAKEUP_FACE",
                        "name": "Face"
                    },
                    {
                        "code": "BEAUTY_MAKEUP_NAILS",
                        "name": "Nails"
                    },
                    {
                        "code": "BEAUTY_MAKEUP_BRUSHES_AND_TOOLS",
                        "name": "Brushes & Tools"
                    },
                    {
                        "code": "BEAUTY_MAKEUP_PALETTE",
                        "name": "Palette"
                    }
                ]
            },
            {
                "code": "BEAUTY_FRAGRANCE",
                "name": "Fragrance",
                "children": [
                    {
                        "code": "BEAUTY_FRAGRANCE_WOMEN",
                        "name": "Women"
                    },
                    {
                        "code": "BEAUTY_FRAGRANCE_MEN",
                        "name": "Men"
                    },
                    {
                        "code": "BEAUTY_FRAGRANCE_SETS",
                        "name": "Sets"
                    },
                    {
                        "code": "BEAUTY_FRAGRANCE_HOME_FRAGRANCE",
                        "name": "Home Fragrance"
                    }
                ]
            },
            {
                "code": "BEAUTY_ORAL_CARE",
                "name": "Oral Care",
                "children": [
                    {
                        "code": "BEAUTY_ORAL_CARE_ELECTRIC_TOOTHBRUSHES",
                        "name": "Electric Toothbrushes"
                    },
                    {
                        "code": "BEAUTY_ORAL_CARE_TOOTHPASTE",
                        "name": "Toothpaste"
                    },
                    {
                        "code": "BEAUTY_ORAL_CARE_MOUTHWASH",
                        "name": "Mouthwash"
                    },
                    {
                        "code": "BEAUTY_ORAL_CARE_WHITENERS",
                        "name": "Whiteners"
                    },
                    {
                        "code": "BEAUTY_ORAL_CARE_FLOSS",
                        "name": "Floss"
                    }
                ]
            }
        ]
    },
    {
        "code": "TOOLS",
        "name": "Tools & Home Improvement",
        "children": [
            {
                "code": "TOOLS_POWER_TOOLS",
                "name": "Power Tools",
                "children": [
                    {
                        "code": "TOOLS_POWER_TOOLS_DRILLS",
                        "name": "Drills"
                    },
                    {
                        "code": "TOOLS_POWER_TOOLS_SAWS",
                        "name": "Saws"
                    },
                    {
                        "code": "TOOLS_POWER_TOOLS_SANDERS",
                        "name": "Sanders"
                    },
                    {
                        "code": "TOOLS_POWER_TOOLS_GRINDERS",
                        "name": "Grinders"
                    },
                    {
                        "code": "TOOLS_POWER_TOOLS_OSCILLATING_TOOLS",
                        "name": "Oscillating Tools"
                    },
                    {
                        "code": "TOOLS_POWER_TOOLS_IMPACT_DRIVERS",
                        "name": "Impact Drivers"
                    },
                    {
                        "code": "TOOLS_POWER_TOOLS_COMBO_KITS",
                        "name": "Combo Kits"
                    }
                ]
            },
            {
                "code": "TOOLS_HAND_TOOLS",
                "name": "Hand Tools",
                "children": [
                    {
                        "code": "TOOLS_HAND_TOOLS_WRENCHES",
                        "name": "Wrenches"
                    },
                    {
                        "code": "TOOLS_HAND_TOOLS_SCREWDRIVERS",
                        "name": "Screwdrivers"
                    },
                    {
                        "code": "TOOLS_HAND_TOOLS_HAMMERS",
                        "name": "Hammers"
                    },
                    {
                        "code": "TOOLS_HAND_TOOLS_PLIERS",
                        "name": "Pliers"
                    },
                    {
                        "code": "TOOLS_HAND_TOOLS_SOCKETS",
                        "name": "Sockets"
                    },
                    {
                        "code": "TOOLS_HAND_TOOLS_LEVELS",
                        "name": "Levels"
                    },
                    {
                        "code": "TOOLS_HAND_TOOLS_CUTTERS",
                        "name": "Cutters"
                    }
                ]
            },
            {
                "code": "TOOLS_ELECTRICAL",
                "name": "Electrical",
                "children": [
                    {
                        "code": "TOOLS_ELECTRICAL_OUTLETS",
                        "name": "Outlets"
                    },
                    {
                        "code": "TOOLS_ELECTRICAL_SWITCHES",
                        "name": "Switches"
                    },
                    {
                        "code": "TOOLS_ELECTRICAL_LIGHT_BULBS",
                        "name": "Light Bulbs"
                    },
                    {
                        "code": "TOOLS_ELECTRICAL_FIXTURES",
                        "name": "Fixtures"
                    },
                    {
                        "code": "TOOLS_ELECTRICAL_SOLAR_PANELS",
                        "name": "Solar Panels"
                    },
                    {
                        "code": "TOOLS_ELECTRICAL_GENSETS",
                        "name": "Gensets"
                    }
                ]
            },
            {
                "code": "TOOLS_PLUMBING",
                "name": "Plumbing",
                "children": [
                    {
                        "code": "TOOLS_PLUMBING_FAUCETS",
                        "name": "Faucets"
                    },
                    {
                        "code": "TOOLS_PLUMBING_SINKS",
                        "name": "Sinks"
                    },
                    {
                        "code": "TOOLS_PLUMBING_SHOWERS",
                        "name": "Showers"
                    },
                    {
                        "code": "TOOLS_PLUMBING_PIPES",
                        "name": "Pipes"
                    },
                    {
                        "code": "TOOLS_PLUMBING_WATER_HEATERS",
                        "name": "Water Heaters"
                    }
                ]
            },
            {
                "code": "TOOLS_BUILDING",
                "name": "Building Supplies",
                "children": [
                    {
                        "code": "TOOLS_BUILDING_HARDWARE",
                        "name": "Hardware"
                    },
                    {
                        "code": "TOOLS_BUILDING_PAINT",
                        "name": "Paint"
                    },
                    {
                        "code": "TOOLS_BUILDING_FLOOR",
                        "name": "Floor"
                    },
                    {
                        "code": "TOOLS_BUILDING_HVAC",
                        "name": "HVAC"
                    },
                    {
                        "code": "TOOLS_BUILDING_WINDOWS",
                        "name": "Windows"
                    }
                ]
            }
        ]
    },
    {
        "code": "PETS",
        "name": "Pet Supplies",
        "children": [
            {
                "code": "PETS_DOGS",
                "name": "Dogs",
                "children": [
                    {
                        "code": "PETS_DOGS_FOOD",
                        "name": "Food"
                    },
                    {
                        "code": "PETS_DOGS_TREATS",
                        "name": "Treats"
                    },
                    {
                        "code": "PETS_DOGS_TOYS",
                        "name": "Toys"
                    },
                    {
                        "code": "PETS_DOGS_BEDS",
                        "name": "Beds"
                    },
                    {
                        "code": "PETS_DOGS_GROOMING",
                        "name": "Grooming"
                    },
                    {
                        "code": "PETS_DOGS_COLLARS_AND_LEASHES",
                        "name": "Collars & Leashes"
                    },
                    {
                        "code": "PETS_DOGS_TRAINING",
                        "name": "Training"
                    },
                    {
                        "code": "PETS_DOGS_HEALTH",
                        "name": "Health"
                    }
                ]
            },
            {
                "code": "PETS_CATS",
                "name": "Cats",
                "children": [
                    {
                        "code": "PETS_CATS_FOOD",
                        "name": "Food"
                    },
                    {
                        "code": "PETS_CATS_TREATS",
                        "name": "Treats"
                    },
                    {
                        "code": "PETS_CATS_LITTER",
                        "name": "Litter"
                    },
                    {
                        "code": "PETS_CATS_FURNITURE",
                        "name": "Furniture"
                    },
                    {
                        "code": "PETS_CATS_TOYS",
                        "name": "Toys"
                    },
                    {
                        "code": "PETS_CATS_GROOMING",
                        "name": "Grooming"
                    },
                    {
                        "code": "PETS_CATS_HEALTH",
                        "name": "Health"
                    }
                ]
            },
            {
                "code": "PETS_FISH",
                "name": "Fish & Aquatic",
                "children": [
                    {
                        "code": "PETS_FISH_AQUARIUMS",
                        "name": "Aquariums"
                    },
                    {
                        "code": "PETS_FISH_FOOD",
                        "name": "Food"
                    },
                    {
                        "code": "PETS_FISH_CARE",
                        "name": "Care"
                    },
                    {
                        "code": "PETS_FISH_DECOR",
                        "name": "Decor"
                    },
                    {
                        "code": "PETS_FISH_LIGHTING",
                        "name": "Lighting"
                    }
                ]
            },
            {
                "code": "PETS_BIRDS",
                "name": "Birds",
                "children": [
                    {
                        "code": "PETS_BIRDS_FOOD",
                        "name": "Food"
                    },
                    {
                        "code": "PETS_BIRDS_CAGES",
                        "name": "Cages"
                    },
                    {
                        "code": "PETS_BIRDS_TOYS",
                        "name": "Toys"
                    },
                    {
                        "code": "PETS_BIRDS_CARE",
                        "name": "Care"
                    }
                ]
            },
            {
                "code": "PETS_SMALL_ANIMALS",
                "name": "Small Animals",
                "children": [
                    {
                        "code": "PETS_SMALL_ANIMALS_CAGES",
                        "name": "Cages"
                    },
                    {
                        "code": "PETS_SMALL_ANIMALS_FOOD",
                        "name": "Food"
                    },
                    {
                        "code": "PETS_SMALL_ANIMALS_TOYS",
                        "name": "Toys"
                    },
                    {
                        "code": "PETS_SMALL_ANIMALS_BEDDING",
                        "name": "Bedding"
                    }
                ]
            }
        ]
    },
    {
        "code": "SPORTS",
        "name": "Sports & Outdoors",
        "children": [
            {
                "code": "SPORTS_EXERCISE",
                "name": "Exercise & Fitness",
                "children": [
                    {
                        "code": "SPORTS_EXERCISE_CARDIO",
                        "name": "Cardio"
                    },
                    {
                        "code": "SPORTS_EXERCISE_STRENGTH_TRAINING",
                        "name": "Strength Training"
                    },
                    {
                        "code": "SPORTS_EXERCISE_YOGA",
                        "name": "Yoga"
                    },
                    {
                        "code": "SPORTS_EXERCISE_ACCESSORIES",
                        "name": "Accessories"
                    },
                    {
                        "code": "SPORTS_EXERCISE_YOGA_MATS",
                        "name": "Yoga Mats"
                    },
                    {
                        "code": "SPORTS_EXERCISE_DUMBBELLS",
                        "name": "Dumbbells"
                    }
                ]
            },
            {
                "code": "SPORTS_OUTDOOR",
                "name": "Outdoor Recreation",
                "children": [
                    {
                        "code": "SPORTS_OUTDOOR_CAMPING",
                        "name": "Camping"
                    },
                    {
                        "code": "SPORTS_OUTDOOR_HIKING",
                        "name": "Hiking"
                    },
                    {
                        "code": "SPORTS_OUTDOOR_CYCLING",
                        "name": "Cycling"
                    },
                    {
                        "code": "SPORTS_OUTDOOR_FISHING",
                        "name": "Fishing"
                    },
                    {
                        "code": "SPORTS_OUTDOOR_HUNTING",
                        "name": "Hunting"
                    },
                    {
                        "code": "SPORTS_OUTDOOR_WATER_SPORTS",
                        "name": "Water Sports"
                    },
                    {
                        "code": "SPORTS_OUTDOOR_CLIMBING",
                        "name": "Climbing"
                    }
                ]
            },
            {
                "code": "SPORTS_TEAM",
                "name": "Team Sports",
                "children": [
                    {
                        "code": "SPORTS_TEAM_SOCCER",
                        "name": "Soccer"
                    },
                    {
                        "code": "SPORTS_TEAM_BASKETBALL",
                        "name": "Basketball"
                    },
                    {
                        "code": "SPORTS_TEAM_BASEBALL",
                        "name": "Baseball"
                    },
                    {
                        "code": "SPORTS_TEAM_FOOTBALL",
                        "name": "Football"
                    },
                    {
                        "code": "SPORTS_TEAM_VOLLEYBALL",
                        "name": "Volleyball"
                    }
                ]
            },
            {
                "code": "SPORTS_GOLF",
                "name": "Golf",
                "children": [
                    {
                        "code": "SPORTS_GOLF_CLUBS",
                        "name": "Clubs"
                    },
                    {
                        "code": "SPORTS_GOLF_BALLS",
                        "name": "Balls"
                    },
                    {
                        "code": "SPORTS_GOLF_BAGS",
                        "name": "Bags"
                    },
                    {
                        "code": "SPORTS_GOLF_CLOTHING",
                        "name": "Clothing"
                    }
                ]
            }
        ]
    },
    {
        "code": "TOYS",
        "name": "Toys & Games",
        "children": [
            {
                "code": "TOYS_BUILDING",
                "name": "Building Toys",
                "children": [
                    {
                        "code": "TOYS_BUILDING_LEGO",
                        "name": "LEGO"
                    },
                    {
                        "code": "TOYS_BUILDING_MAGNETIC",
                        "name": "Magnetic"
                    },
                    {
                        "code": "TOYS_BUILDING_KITS",
                        "name": "Kits"
                    }
                ]
            },
            {
                "code": "TOYS_DOLLS",
                "name": "Dolls & Accessories",
                "children": [
                    {
                        "code": "TOYS_DOLLS_DOLLS",
                        "name": "Dolls"
                    },
                    {
                        "code": "TOYS_DOLLS_HOUSES",
                        "name": "Houses"
                    },
                    {
                        "code": "TOYS_DOLLS_FURNITURE",
                        "name": "Furniture"
                    }
                ]
            },
            {
                "code": "TOYS_GAMES",
                "name": "Games",
                "children": [
                    {
                        "code": "TOYS_GAMES_BOARD_GAMES",
                        "name": "Board Games"
                    },
                    {
                        "code": "TOYS_GAMES_CARD_GAMES",
                        "name": "Card Games"
                    },
                    {
                        "code": "TOYS_GAMES_PUZZLES",
                        "name": "Puzzles"
                    },
                    {
                        "code": "TOYS_GAMES_ELECTRONIC_GAMES",
                        "name": "Electronic Games"
                    }
                ]
            },
            {
                "code": "TOYS_OUTDOOR",
                "name": "Outdoor Play",
                "children": [
                    {
                        "code": "TOYS_OUTDOOR_BIKES",
                        "name": "Bikes"
                    },
                    {
                        "code": "TOYS_OUTDOOR_SLIDES",
                        "name": "Slides"
                    },
                    {
                        "code": "TOYS_OUTDOOR_POOLS",
                        "name": "Pools"
                    },
                    {
                        "code": "TOYS_OUTDOOR_SWINGS",
                        "name": "Swings"
                    }
                ]
            }
        ]
    },
    {
        "code": "GARDEN",
        "name": "Patio, Lawn & Garden",
        "children": [
            {
                "code": "GARDEN_GRILLS",
                "name": "Grills & Outdoor Cooking",
                "children": [
                    {
                        "code": "GARDEN_GRILLS_GRILLS",
                        "name": "Grills"
                    },
                    {
                        "code": "GARDEN_GRILLS_SMOKERS",
                        "name": "Smokers"
                    },
                    {
                        "code": "GARDEN_GRILLS_ACCESSORIES",
                        "name": "Accessories"
                    },
                    {
                        "code": "GARDEN_GRILLS_FRYERS",
                        "name": "Fryers"
                    }
                ]
            },
            {
                "code": "GARDEN_FURNITURE",
                "name": "Outdoor Furniture",
                "children": [
                    {
                        "code": "GARDEN_FURNITURE_SEATING",
                        "name": "Seating"
                    },
                    {
                        "code": "GARDEN_FURNITURE_DINING",
                        "name": "Dining"
                    },
                    {
                        "code": "GARDEN_FURNITURE_UMBRELLAS",
                        "name": "Umbrellas"
                    },
                    {
                        "code": "GARDEN_FURNITURE_COVERS",
                        "name": "Covers"
                    }
                ]
            },
            {
                "code": "GARDEN_TOOLS",
                "name": "Garden Tools",
                "children": [
                    {
                        "code": "GARDEN_TOOLS_MOWERS",
                        "name": "Mowers"
                    },
                    {
                        "code": "GARDEN_TOOLS_TRIMMERS",
                        "name": "Trimmers"
                    },
                    {
                        "code": "GARDEN_TOOLS_BLOWERS",
                        "name": "Blowers"
                    },
                    {
                        "code": "GARDEN_TOOLS_PRUNERS",
                        "name": "Pruners"
                    },
                    {
                        "code": "GARDEN_TOOLS_SPRINKLERS",
                        "name": "Sprinklers"
                    }
                ]
            },
            {
                "code": "GARDEN_PLANTS",
                "name": "Plants & Seeds",
                "children": [
                    {
                        "code": "GARDEN_PLANTS_FLOWERS",
                        "name": "Flowers"
                    },
                    {
                        "code": "GARDEN_PLANTS_VEGETABLES",
                        "name": "Vegetables"
                    },
                    {
                        "code": "GARDEN_PLANTS_TREES",
                        "name": "Trees"
                    },
                    {
                        "code": "GARDEN_PLANTS_FERTILIZERS",
                        "name": "Fertilizers"
                    }
                ]
            }
        ]
    }
];