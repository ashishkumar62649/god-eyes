# Aviation Category Audit WO-029E

WO-029E audits Layer 1 aviation category distribution and water/seaplane
mapping for frontend category display planning. This is a data truth reference
only. It does not modify frontend code, API implementation, database
migrations, contracts, source data, or raw storage.

Measured with:

```powershell
python scripts\aviation_category_audit.py --json --country-limit 25 --region-limit 25 --sample-limit 3 --pattern-limit 30 --country-major-limit 100
```

Environment:

| Item | Value |
|---|---|
| Local database | Docker PostGIS `god_eyes_dev` |
| Table | `aviation_airports` |
| Source | `ourairports` |
| Layer | `layer_01_aviation` |
| Script | `scripts/aviation_category_audit.py` |

## Exact Database Categories And Counts

The local normalized table has 85,377 airport records.

| `category_normalized` | Count |
|---|---:|
| `small_airfield` | 42,616 |
| `heliport` | 22,980 |
| `closed_or_abandoned` | 13,181 |
| `regional_or_domestic_airport` | 4,095 |
| `water_landing_site` | 1,262 |
| `international_or_major_airport` | 1,182 |
| `balloonport` | 61 |
| `unknown` | 0 |

`unknown` is a valid normalized fallback category, but it has no current rows in
the measured database.

## Source Type Distribution

All current source type values come from OurAirports `airports.csv` `type`.

| `source_id` | `type_source` | `category_normalized` | Count |
|---|---|---|---:|
| `ourairports` | `small_airport` | `small_airfield` | 42,616 |
| `ourairports` | `heliport` | `heliport` | 22,980 |
| `ourairports` | `closed` | `closed_or_abandoned` | 13,181 |
| `ourairports` | `medium_airport` | `regional_or_domestic_airport` | 4,095 |
| `ourairports` | `seaplane_base` | `water_landing_site` | 1,262 |
| `ourairports` | `large_airport` | `international_or_major_airport` | 1,182 |
| `ourairports` | `balloonport` | `balloonport` | 61 |

Current source type values are fully covered by the normalizer mapping. The
schema also maps `closed_airport` to `closed_or_abandoned`, but the current
database has no `closed_airport` source rows.

## Recommended Frontend Display Category Mapping

Use these eight left-panel categories if the UI needs the requested full
category split.

| `category_normalized` | Recommended display label | Source value(s) |
|---|---|---|
| `international_or_major_airport` | Major / International | `large_airport` |
| `regional_or_domestic_airport` | Regional / Domestic | `medium_airport` |
| `small_airfield` | Local / Small Airfields | `small_airport` |
| `heliport` | Heliports | `heliport` |
| `water_landing_site` | Water / Seaplane | `seaplane_base` |
| `balloonport` | Balloonports | `balloonport` |
| `unknown` | Unknown / Unclassified | unmapped or blank source type |
| `closed_or_abandoned` | Closed / Historical | `closed`, `closed_airport` |

Coverage verdict:

- The eight-category mapping covers all real normalized categories in the
  current local database.
- No current database category is missing from this mapping.
- A reduced display that collapses major, regional, and small facilities into a
  single airport bucket will not satisfy the requested eight-category left
  panel, even though it can still cover the records at a coarse level.
- `unknown` must remain in the display contract even though the current count is
  zero, because it is the normalizer fallback for future unmapped source values.

## India And China Major Airport Evidence

Major/international means `category_normalized =
international_or_major_airport`, which is sourced from OurAirports
`type_source = large_airport`.

| Country | Major / International count | Returned by audit |
|---|---:|---:|
| `IN` India | 43 | 43 |
| `CN` China | 69 | 69 |

India major/international airport list:

| Ident | IATA | Name | Region | Source airport id |
|---|---|---|---|---:|
| `VAAH` | `AMD` | Sardar Vallabh Patel International Airport | `IN-GJ` | 26431 |
| `VIAR` | `ATQ` | Sri Guru Ram Das Ji International Airport | `IN-PB` | 26540 |
| `VEBS` | `BBI` | Biju Patnaik International Airport | `IN-OR` | 26494 |
| `VABO` | `BDQ` | Vadodara International Airport | `IN-GJ` | 26438 |
| `VABP` | `BHO` | Raja Bhoj International Airport | `IN-MP` | 26439 |
| `VOBL` | `BLR` | Kempegowda International Airport Bengaluru | `IN-KA` | 35145 |
| `VABB` | `BOM` | Chhatrapati Shivaji Maharaj International Airport | `IN-MM` | 26434 |
| `VOCL` | `CCJ` | Calicut International Airport | `IN-KL` | 26610 |
| `VECC` | `CCU` | Netaji Subhash Chandra Bose International Airport | `IN-WB` | 26496 |
| `VOCB` | `CJB` | Coimbatore International Airport | `IN-TN` | 26607 |
| `VOKN` | `CNN` | Kannur International Airport | `IN-KL` | 329504 |
| `VOCI` | `COK` | Cochin International Airport | `IN-KL` | 26609 |
| `VIDP` | `DEL` | Indira Gandhi International Airport | `IN-DL` | 26555 |
| `VEGT` | `GAU` | Lokpriya Gopinath Bordoloi International Airport | `IN-AS` | 26501 |
| `VOGO` | `GOI` | Goa Dabolim International Airport | `IN-GA` | 26444 |
| `VOGA` | `GOX` | Manohar International Airport | `IN-GA` | 342094 |
| `VAHS` | `HSR` | Rajkot International Airport | `IN-GJ` | 512065 |
| `VIHR` | `HSS` | Maharaja Agrasen International Airport | `IN-HR` | 26559 |
| `VIHX` | `HWR` | Halwara International Airport | `IN-PB` | 26560 |
| `VOHS` | `HYD` | Rajiv Gandhi International Airport | `IN-TG` | 35141 |
| `VAID` | `IDR` | Devi Ahilya Bai Holkar International Airport | `IN-MP` | 26446 |
| `VEIM` | `IMF` | Bir Tikendrajit International Airport | `IN-MN` | 26504 |
| `VAOZ` | `ISK` | Nashik International Airport | `IN-MM` | 3301 |
| `VEBD` | `IXB` | Bagdogra Airport | `IN-WB` | 26491 |
| `VICG` | `IXC` | Shaheed Bhagat Singh International Airport | `IN-CH` | 26550 |
| `VOML` | `IXE` | Mangaluru International Airport | `IN-KA` | 26617 |
| `VOPB` | `IXZ` | Veer Savarkar International Airport / INS Utkrosh | `IN-AN` | 26620 |
| `VIJP` | `JAI` | Jaipur International Airport | `IN-RJ` | 26563 |
| `VILK` | `LKO` | Chaudhary Charan Singh International Airport | `IN-UP` | 26570 |
| `VOMM` | `MAA` | Chennai International Airport | `IN-TN` | 26618 |
| `VANP` | `NAG` | Dr. Babasaheb Ambedkar International Airport | `IN-MM` | 26453 |
| `IN-0276` | `NMI` | Navi Mumbai International Airport | `IN-MM` | 342093 |
| `VAPO` | `PNQ` | Pune International Airport | `IN-MM` | 26455 |
| `VASD` | `SAG` | Shirdi International Airport | `IN-MM` | 327452 |
| `VASU` | `STV` | Surat International Airport | `IN-GJ` | 26461 |
| `VISR` | `SXR` | Sheikh ul Alam International Airport | `IN-JK` | 26578 |
| `VOTP` | `TIR` | Tirupati International Airport | `IN-AP` | 26627 |
| `VOTV` | `TRV` | Thiruvananthapuram International Airport | `IN-KL` | 26629 |
| `VOTR` | `TRZ` | Tiruchirappalli International Airport | `IN-TN` | 26628 |
| `VOBZ` | `VGA` | Vijayawada International Airport | `IN-AP` | 26606 |
| `VEBN` | `VNS` | Lal Bahadur Shastri International Airport | `IN-UP` | 26545 |
| `VEVZ` | `VTZ` | Visakhapatnam International Airport | `IN-AP` | 26523 |
| `IN-0392` | `DXN` | Noida International Airport | `IN-UP` | 597786 |

China major/international airport list:

| Ident | IATA | Name | Region | Source airport id |
|---|---|---|---|---:|
| `ZBOW` | `BAV` | Baotou Donghe International Airport | `CN-15` | 30679 |
| `ZGGG` | `CAN` | Guangzhou Baiyun International Airport | `CN-44` | 27194 |
| `ZHCC` | `CGO` | Zhengzhou Xinzheng International Airport | `CN-41` | 27199 |
| `ZYCC` | `CGQ` | Changchun Longjia International Airport | `CN-22` | 27237 |
| `ZUCK` | `CKG` | Chongqing Jiangbei International Airport | `CN-50` | 27228 |
| `ZGHA` | `CSX` | Changsha Huanghua International Airport | `CN-43` | 27195 |
| `ZUUU` | `CTU` | Chengdu Shuangliu International Airport | `CN-51` | 27230 |
| `ZBDT` | `DAT` | Datong Yungang International Airport | `CN-14` | 30876 |
| `ZYTL` | `DLC` | Dalian Zhoushuizi International Airport | `CN-21` | 27242 |
| `ZLDH` | `DNH` | Dunhuang Mogao International Airport | `CN-62` | 30929 |
| `ZBDS` | `DSN` | Ordos Ejin Horo International Airport | `CN-15` | 300513 |
| `ZGDY` | `DYG` | Zhangjiajie Hehua International Airport | `CN-43` | 30958 |
| `ZHEC` | `EHU` | Ezhou Huahu International Airport | `CN-42` | 347108 |
| `ZSFZ` | `FOC` | Fuzhou Changle International Airport | `CN-35` | 27217 |
| `ZJHK` | `HAK` | Haikou Meilan International Airport | `CN-46` | 27201 |
| `ZBHH` | `HET` | Hohhot Baita International Airport | `CN-15` | 27189 |
| `ZSOF` | `HFE` | Hefei Xinqiao International Airport | `CN-34` | 27222 |
| `ZSHC` | `HGH` | Hangzhou Xiaoshan International Airport | `CN-33` | 27218 |
| `ZSSH` | `HIA` | Huai'an Lianshui Airport | `CN-32` | 300863 |
| `ZBLA` | `HLD` | Hulunbuir Hailar Airport | `CN-15` | 27190 |
| `ZYHB` | `HRB` | Harbin Taiping International Airport | `CN-23` | 27238 |
| `ZSZS` | `HSN` | Zhoushan Putuoshan International Airport | `CN-33` | 31624 |
| `ZLIC` | `INC` | Yinchuan Hedong International Airport | `CN-64` | 298989 |
| `ZLJQ` | `JGN` | Jiayuguan International Airport | `CN-62` | 31699 |
| `ZPJH` | `JHG` | Xishuangbanna Gasa International Airport | `CN-53` | 27213 |
| `ZSQZ` | `JJN` | Quanzhou Jinjiang International Airport | `CN-35` | 31705 |
| `ZWSH` | `KHG` | Kashgar Laining International Airport | `CN-65` | 27234 |
| `ZSCN` | `KHN` | Nanchang Changbei International Airport | `CN-36` | 27216 |
| `ZPPP` | `KMG` | Kunming Changshui International Airport | `CN-53` | 27214 |
| `ZUGY` | `KWE` | Guiyang Longdongbao International Airport | `CN-52` | 27229 |
| `ZGKL` | `KWL` | Guilin Liangjiang International Airport | `CN-45` | 27196 |
| `ZLLL` | `LHW` | Lanzhou Zhongchuan International Airport | `CN-62` | 27204 |
| `ZPLJ` | `LJG` | Lijiang Sanyi International Airport | `CN-53` | 31828 |
| `ZULS` | `LXA` | Lhasa Gonggar International Airport | `CN-54` | 31867 |
| `ZHLY` | `LYA` | Luoyang Beijiao Airport | `CN-41` | 31870 |
| `ZSLG` | `LYG` | Lianyungang Huaguoshan International Airport | `CN-32` | 44167 |
| `ZYQQ` | `NDG` | Qiqihar Sanjiazi Airport | `CN-23` | 27241 |
| `ZSNB` | `NGB` | Ningbo Lishe International Airport | `CN-33` | 27220 |
| `ZSNJ` | `NKG` | Nanjing Lukou International Airport | `CN-32` | 27221 |
| `ZGNN` | `NNG` | Nanning Wuxu International Airport | `CN-45` | 27197 |
| `ZBAA` | `PEK` | Beijing Capital International Airport | `CN-11` | 27188 |
| `ZBAD` | `PKX` | Beijing Daxing International Airport | `CN-11` | 330820 |
| `ZSPD` | `PVG` | Shanghai Pudong International Airport | `CN-31` | 27223 |
| `ZURK` | `RKZ` | Xigaze Peace Airport / Shigatse Air Base | `CN-54` | 44122 |
| `ZSSS` | `SHA` | Shanghai Hongqiao International Airport | `CN-31` | 27225 |
| `ZYTX` | `SHE` | Shenyang Taoxian International Airport | `CN-21` | 27243 |
| `ZBSJ` | `SJW` | Shijiazhuang Zhengding International Airport | `CN-13` | 27191 |
| `ZGOW` | `SWA` | Jieyang Chaoshan International Airport | `CN-44` | 32400 |
| `ZJSY` | `SYX` | Sanya Phoenix International Airport | `CN-46` | 27202 |
| `ZGSZ` | `SZX` | Shenzhen Bao'an International Airport | `CN-44` | 27198 |
| `ZSQD` | `TAO` | Qingdao Jiaodong International Airport | `CN-37` | 342096 |
| `ZUTF` | `TFU` | Chengdu Tianfu International Airport | `CN-51` | 342095 |
| `ZSJN` | `TNA` | Jinan Yaoqiang International Airport | `CN-37` | 27219 |
| `ZBTJ` | `TSN` | Tianjin Binhai International Airport | `CN-12` | 27192 |
| `ZSTX` | `TXN` | Huangshan Tunxi International Airport | `CN-34` | 32489 |
| `ZBYN` | `TYN` | Taiyuan Wusu International Airport | `CN-14` | 27193 |
| `ZWWW` | `URC` | Urumqi Tianshan International Airport | `CN-65` | 27236 |
| `ZSWZ` | `WNZ` | Wenzhou Longwan International Airport | `CN-33` | 32672 |
| `ZHHH` | `WUH` | Wuhan Tianhe International Airport | `CN-42` | 27200 |
| `ZSWX` | `WUX` | Sunan Shuofang International Airport | `CN-32` | 32684 |
| `ZLXY` | `XIY` | Xi'an Xianyang International Airport | `CN-61` | 27205 |
| `ZSAM` | `XMN` | Xiamen Gaoqi International Airport | `CN-35` | 27215 |
| `ZLXN` | `XNN` | Xining Caojiabao International Airport | `CN-63` | 32709 |
| `ZBYC` | `YCU` | Yuncheng Yanhu International Airport | `CN-61` | 300455 |
| `ZSYW` | `YIW` | Yiwu Airport | `CN-33` | 32726 |
| `ZSYT` | `YNT` | Yantai Penglai International Airport | `CN-37` | 332096 |
| `ZSYN` | `YNZ` | Yancheng Nanyang International Airport | `CN-32` | 35316 |
| `ZGZJ` | `ZHA` | Zhanjiang Wuchuan International Airport | `CN-44` | 354995 |
| `ZGSD` | `ZUH` | Zhuhai Jinwan Airport | `CN-44` | 30593 |

Top countries by major/international count:

| Country | Count |
|---|---:|
| `US` | 95 |
| `CN` | 69 |
| `RU` | 44 |
| `IN` | 43 |
| `JP` | 29 |
| `MX` | 29 |
| `BR` | 28 |
| `IT` | 25 |
| `DE` | 22 |
| `ES` | 21 |

Verdict: India and China major/international airports are present in the
normalized data. If they are missing at globe zoom, the likely cause is display
filtering, viewport limit behavior, clustering, or renderer category handling,
not absence from the local normalized table.

## Asia Water And Seaplane Evidence

`water_landing_site` rows are sourced from `type_source = seaplane_base`. The
current table has 1,262 water/seaplane records globally.

Top global countries for `water_landing_site`:

| Country | Continent | Count |
|---|---|---:|
| `US` United States | `NA` | 676 |
| `CA` Canada | `NA` | 443 |
| `FR` France | `EU` | 19 |
| `LK` Sri Lanka | `AS` | 18 |
| `MV` Maldives | `AS` | 11 |
| `IT` Italy | `EU` | 7 |
| `NO` Norway | `EU` | 7 |
| `JP` Japan | `AS` | 6 |
| `MX` Mexico | `NA` | 6 |
| `PH` Philippines | `AS` | 6 |
| `FJ` Fiji | `OC` | 5 |
| `AU` Australia | `OC` | 4 |
| `GB` United Kingdom | `EU` | 4 |
| `GF` French Guiana | `SA` | 4 |
| `NZ` New Zealand | `OC` | 4 |

Asia `water_landing_site` counts sum to 50 across the countries below:

| Country | Count |
|---|---:|
| `LK` Sri Lanka | 18 |
| `MV` Maldives | 11 |
| `JP` Japan | 6 |
| `PH` Philippines | 6 |
| `CN` China | 3 |
| `AE` United Arab Emirates | 2 |
| `IN` India | 1 |
| `KR` South Korea | 1 |
| `TR` Turkey | 1 |
| `VN` Vietnam | 1 |

Asia water/seaplane examples:

| Country | Ident | IATA | Name | Region | Source airport id |
|---|---|---|---|---|---:|
| `AE` | `AYM` | `AYM` | Yas Island Seaplane Base | `AE-AZ` | 317271 |
| `AE` | `AE-0237` | `DST` | Dubai Seaplane Terminal | `AE-DU` | 604702 |
| `CN` | `CN-0315` |  | Jinshan City Beach Seaplane Base | `CN-31` | 353165 |
| `CN` | `CN-0101` |  | Qingdao Naval Base | `CN-37` | 44179 |
| `CN` | `CN-0412` | `ZGN` | Zhongshan Ferry Port | `CN-44` | 524237 |
| `IN` | `IN-0293` |  | Hut Bay Seaplane Base | `IN-AN` | 347144 |
| `JP` | `JP-0001` |  | JMSDF Chichijima Airfield | `JP-13` | 41849 |
| `JP` | `JP-1339` |  | Setouchi Seaplanes Nakaumi Skyport | `JP-32` | 340788 |
| `JP` | `JP-2544` |  | Onomichi Seaplane Base | `JP-34` | 348872 |
| `JP` | `JP-1262` |  | Tsushima Seaplane Base | `JP-42` | 340708 |
| `JP` | `JP-3099` |  | JMSDF Sasebo Base Sakibe Seaplane Base | `JP-42` | 430141 |
| `JP` | `JP-2545` |  | Setouchi Seaplanes Beppu Seaplane Base | `JP-44` | 348873 |
| `KR` | `KR-1110` |  | Jungwon Air Boryeon Airfield | `KR-44` | 608543 |
| `LK` | `BJT` | `BJT` | Bentota River Waterdrome | `LK-1` | 312172 |
| `LK` | `BYV` | `BYV` | Beira Lake Seaplane Base | `LK-1` | 300806 |
| `LK` | `DGM` | `DGM` | Dandugama Seaplane Base | `LK-1` | 317274 |
| `LK` | `DWO` | `DWO` | Diyawanna Oya Seaplane Base | `LK-1` | 318125 |
| `LK` | `KEZ` | `KEZ` | Kelani-Peliyagoda Seaplane Base | `LK-1` | 317278 |

Verdict: water/seaplane facilities are present, but Asia has only 50 of the
1,262 global water/seaplane rows. The large global count is concentrated in
North America, especially United States and Canada.

## Possible Seaplane Water Floatplane Values In Source Fields

Search terms used for audit evidence: `seaplane`, `water`, `floatplane`,
`float`.

Matching records by source type and normalized category:

| `type_source` | `category_normalized` | Matching records |
|---|---|---:|
| `seaplane_base` | `water_landing_site` | 1,262 |
| `closed` | `closed_or_abandoned` | 295 |
| `small_airport` | `small_airfield` | 93 |
| `heliport` | `heliport` | 70 |
| `medium_airport` | `regional_or_domestic_airport` | 11 |
| `large_airport` | `international_or_major_airport` | 1 |

Important interpretation:

- The reliable source field for water/seaplane classification is
  `type_source = seaplane_base`.
- Name/keyword text matching is useful for QA examples, but it is not a safe
  category rule. It catches non-water records whose names or keywords contain
  water-related words.
- Some `seaplane_base` records have names like "Waterdrome", "Water
  Aerodrome", "Seaplane Dock", "Ferry Port", or "Naval Base", so display copy
  should say "Water / Seaplane" rather than only "Seaplane Base".

## Missing Or Ambiguous Mappings

| Finding | Status | Recommendation |
|---|---|---|
| Database categories missing from eight-category display mapping | None | Use the mapping in this document. |
| Source type values missing from schema mapping | None | Current source values are covered. |
| `unknown` rows | 0 | Keep display support as fallback. |
| `closed_airport` source rows | 0 | Keep schema mapping because the normalizer supports it. |
| Water/seaplane text aliases | Ambiguous outside `type_source` | Classify by `type_source`, use text only for QA/search. |
| Asia water/seaplane count | Low but present | Do not infer missing data solely from low Asia count. |

## QA Examples

Use these records for category display QA. The examples are intentionally
source-identifiable so API/frontend teams can search by ident or source id.

| Display category | Ident | Name | Country | Source type | Source airport id |
|---|---|---|---|---|---:|
| Major / International | `OMAA` | Zayed International Airport | `AE` | `large_airport` | 5226 |
| Major / International | `OMDB` | Dubai International Airport | `AE` | `large_airport` | 5235 |
| Major / International | `VIDP` | Indira Gandhi International Airport | `IN` | `large_airport` | 26555 |
| Regional / Domestic | `OAKS` | Khost International Airport | `AF` | `medium_airport` | 332240 |
| Regional / Domestic | `OAMN` | Maymana Zahiraddin Faryabi Airport | `AF` | `medium_airport` | 5074 |
| Regional / Domestic | `AG-0001` | Burton-Nibbs International Airport | `AG` | `medium_airport` | 336537 |
| Local / Small Airfields | `OMDL` | Delma Airport | `AE` | `small_airport` | 315507 |
| Local / Small Airfields | `OAFZ` | Fayzabad Airport | `AF` | `small_airport` | 31065 |
| Local / Small Airfields | `SCRM` | Teniente Rodolfo Marsh Martin Airport | `AQ` | `small_airport` | 6039 |
| Heliports | `EECL` | Tallinn Linnahall Heliport | `EE` | `heliport` | 43020 |
| Heliports | `GECE` | Ceuta Heliport | `ES` | `heliport` | 35151 |
| Heliports | `GB-1327` | Penzance Heliport | `GB` | `heliport` | 595235 |
| Water / Seaplane | `AU-HIS` | Hayman Island Resort Seaplane Base | `AU` | `seaplane_base` | 35302 |
| Water / Seaplane | `LBH` | Palm Beach Seaplane Base | `AU` | `seaplane_base` | 313852 |
| Water / Seaplane | `IN-0293` | Hut Bay Seaplane Base | `IN` | `seaplane_base` | 347144 |
| Balloonports | `AR-0136` | El Manantial Airport | `AR` | `balloonport` | 38811 |
| Balloonports | `BE-0012` | Ceroux-Mousty Balloon Field | `BE` | `balloonport` | 324445 |
| Balloonports | `CA-0787` | High River Balloonport | `CA` | `balloonport` | 355108 |
| Unknown / Unclassified | none in current database | No current QA row | n/a | n/a | n/a |
| Closed / Historical | `TAPH` | Codrington Airport | `AG` | `closed` | 35328 |
| Closed / Historical | `CN-0446` | Jining Qufu Airport | `CN` | `closed` | 300515 |
| Closed / Historical | `BGJH` | Qaqortoq Heliport | `GL` | `closed` | 35298 |

## Warnings And Limitations

- Counts reflect the local Docker database at the time of WO-029E.
- OurAirports is reference data, not live operational aviation data.
- `closed_or_abandoned` is source-derived reference status, not a live closure
  notice.
- Category mapping is based on normalized airport type only. It does not
  inspect runways, services, passenger volumes, current airline schedules, or
  live operations.
- Source names can contain "International" even when the normalized source type
  is not `large_airport`; display categories should use `category_normalized`.
- Water/seaplane display should use `water_landing_site`, not text search.
- Asia water/seaplane records exist but are sparse compared with North America.
- `unknown` has no current rows, so QA must use a synthetic API/mock case only
  if frontend behavior for unknown needs visual verification. Do not add fake
  rows to the database for this audit.
- This document does not define API response contracts or modify frontend
  filters.

## Regeneration

To refresh this reference after a source update, run:

```powershell
python scripts\aviation_category_audit.py --json --country-limit 25 --region-limit 25 --sample-limit 3 --pattern-limit 30 --country-major-limit 100
```

Update this document only when source distribution or category mapping changes
materially. Do not commit generated JSON dumps.
