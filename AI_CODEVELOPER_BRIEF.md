# APEX CHAOS - Game & Champion Ideation Bible

File này dành cho một AI đồng phát triển về **ý tưởng tướng, kỹ năng, nhịp combat, cảm giác hình ảnh/âm thanh và fantasy gameplay** của APEX CHAOS.

AI đọc file này **không cần biết cách code**. Mục tiêu là hiểu game đủ sâu để cùng người thiết kế nghĩ ra tướng mới, nâng cấp tướng hiện có, đề xuất cơ chế thú vị, và tránh tạo ra ý tưởng bị trùng vai trò với 5 tướng core hiện tại.

---

## 1. APEX CHAOS là game gì?

APEX CHAOS là game đối kháng auto-battle 1v1 trong một đấu trường vuông. Hai nhân vật tự di chuyển, va chạm, dùng kỹ năng, kích hoạt trạng thái đặc biệt và tạo ra các khoảnh khắc điện ảnh.

Trận đấu không chỉ là "ai gây sát thương nhiều hơn". Cái quan trọng là mỗi tướng phải tạo ra một **luật chơi riêng**:

- ICE biến trận đấu thành bài toán khống chế và hành quyết khi đóng băng.
- STRING biến sân thành mạng nhện và dùng combo tích lũy.
- GALAXY biến combat thành khoảnh khắc vũ trụ nặng, chậm, có stop-motion.
- SOCCER biến game đối kháng thành một trận bóng bạo lực với sở hữu bóng, sút, phản công, penalty.
- NINJA biến không gian thành hệ thống kunai, shuriken, teleport và sát thủ tốc độ cao.

HP mặc định hiện tại của nhân vật là 1000. Người chơi có thể chỉnh HP và phần trăm sát thương cho P1/P2 trước trận.

---

## 2. Triết lý thiết kế tướng

Một tướng tốt trong APEX CHAOS cần có 5 thứ:

1. **Fantasy rõ**
   Người chơi chỉ cần nhìn vài giây là hiểu tướng này đại diện cho điều gì: băng, dây, vũ trụ, bóng đá, ninja, thời gian, âm nhạc, quái vật, v.v.

2. **Luật chơi riêng**
   Tướng không nên chỉ là "đánh nhanh hơn" hoặc "gây nhiều damage hơn". Tướng nên thay đổi cách trận đấu vận hành: tạo vùng, đặt bẫy, tích tài nguyên, đổi trạng thái, kiểm soát tường, thao túng mục tiêu, điều khiển vật thể phụ.

3. **Vòng lặp dễ đọc**
   Người xem cần hiểu được chu kỳ: chuẩn bị > đe dọa > kích hoạt > va chạm > hậu quả. Kỹ năng mạnh nên có dấu hiệu báo trước, animation, âm thanh và kết quả rõ.

4. **Khoảnh khắc biểu tượng**
   Mỗi tướng nên có ít nhất một khoảnh khắc người chơi nhớ ngay: GALAXY ngưng thời gian trước cú đấm, SOCCER sút bóng đẩy đối thủ vào khung thành, ICE xếp cung tên băng rồi xiên khi băng vỡ.

5. **Có phản khắc chế**
   Tướng mạnh vẫn cần có cách thất bại: hụt timing, bị né, bị kéo khỏi vị trí, chưa đủ stack, bị phá setup, hoặc bị ép vào trạng thái không thuận lợi.

---

## 3. Ngôn ngữ combat chung

Khi đề xuất tướng mới, AI nên dùng các khái niệm này:

- **Windup**: thời gian chuẩn bị trước khi tung chiêu. Dùng để người xem thấy sắp có chuyện lớn.
- **Release**: khoảnh khắc chiêu thực sự phát ra.
- **Impact**: va chạm gây sát thương, đẩy lùi, stun, freeze, grab, carry hoặc hiệu ứng đặc biệt.
- **Aftermath**: hậu quả còn lại sau chiêu như vùng nguy hiểm, debuff, vật thể, dấu ấn, cooldown.
- **Hit stop / stop motion**: khoảnh khắc dừng hoặc làm chậm để cú đánh có lực. Dùng cho chiêu lớn, không nên lạm dụng cho mọi đòn.
- **Terrain**: sát thương hoặc ảnh hưởng từ vùng sân/địa hình. Một số né tránh không chống được terrain.
- **Status**: frozen, stun, slow, immune, rage, possession, body thread, pressure, v.v.
- **Wall interaction**: tường rất quan trọng. Tướng có thể bật tường, cắm vật thể, lấy stack từ tường, dùng tường làm điều kiện kích hoạt.
- **Rage**: trạng thái cường hóa. Rage nên khuếch đại bản sắc của tướng, không chỉ tăng damage đơn giản.
- **HUD resource**: nếu tướng có cơ chế phức tạp, nên có chỉ báo như stack, cooldown, charge, live objects, pressure, possession.

---

## 4. Năm tướng core hiện tại

### ICE

**Fantasy:** pháp sư/chiến binh băng, kiểm soát nhịp trận bằng đóng băng, vùng lạnh và hành quyết khi đối thủ bị khống chế.

**Vai trò:** control, terrain, delayed execution.

**Cảm giác chơi/xem:**
ICE không cần lúc nào cũng đánh mạnh ngay. ICE làm trận đấu chậm lại, ép đối thủ vào trạng thái bất lợi, rồi dùng một đợt băng chính xác để trừng phạt.

**Các ý tưởng core hiện có:**

- Có khả năng làm đối thủ frozen.
- Khi đối thủ bị frozen, ICE vẫn tiếp tục tạo mũi tên băng.
- Mũi tên băng không xuất hiện sẵn cạnh mục tiêu. Chúng bay ra từ ICE, xếp thành một cung tròn trước đối thủ.
- Cung băng nên rộng khoảng 1/3 đường tròn, các mũi tên không quá sát nhau, không overlay nhau.
- Mũi tên nên chỉa hướng sẵn theo hướng sẽ xiên, không nằm ngang một cách vô nghĩa.
- Khi băng vừa vỡ, các mũi tên đồng loạt xiên vào mục tiêu, timing sao cho cảm giác "băng tan là án phạt tới".
- Rage/ICE AGE là dạng địa hình nguy hiểm. Một số né tránh như dash của SOCCER không nên né được sát thương terrain như ICE AGE.

**Điều ICE dạy cho thiết kế tướng mới:**

- Khống chế hay hơn nếu có payoff sau đó.
- Một chiêu đẹp không chỉ là projectile bay vào mục tiêu, mà là bố cục, khoảng cách, hướng, timing và lý do nó xuất hiện.
- Terrain nên có luật riêng khác với đòn đánh thường.

**Không nên tạo tướng mới quá giống ICE nếu:**

- Cũng chỉ xoay quanh freeze, slow field và projectile hành quyết.
- Cũng dùng "đóng băng rồi bắn hàng loạt" mà không có twist mới.

---

### STRING

**Fantasy:** kẻ điều khiển dây/tơ/mạng, đặt bẫy trên sân, khống chế cơ thể đối thủ và combo theo chu kỳ cắt.

**Vai trò:** setup, trap control, stacking debuff, combo escalation.

**Cảm giác chơi/xem:**
STRING là tướng càng đánh lâu càng khiến sân trở nên nguy hiểm. Người xem nên có cảm giác đối thủ đang bị kéo vào một cái mạng, càng vùng vẫy càng bị kiểm soát.

**Các ý tưởng core hiện có:**

- Có hai lớp kiểm soát chính:
  - **Wall threads:** dây gắn/tương tác với tường, tăng tốc hoặc tạo lợi thế di chuyển/địa hình.
  - **Body threads:** dây bám vào người đối thủ, làm chậm, khống chế hoặc tăng hiệu quả combo.
- HUD thể hiện các thông tin kiểu:
  - Wall Threads.
  - Body Threads.
  - Cut Cycle.
  - Các mốc skill kế tiếp như NONE, STRINGSHOT, OVERHEAT, GOD THREADS.
- Body threads có thể làm đối thủ chậm dần.
- Rage của STRING nên làm cảm giác "bị mắc lưới" nặng hơn, ví dụ giảm damage nhận vào dựa trên lượng dây đã cắm hoặc tăng độ nguy hiểm của mạng dây.
- Bộ kỹ năng có thể dùng các hình ảnh như string shot, overheat whip, five-color strings, god threads, bird cage, body web.

**Điều STRING dạy cho thiết kế tướng mới:**

- Tướng setup cần có sự tích lũy thấy được.
- Một resource tốt nên vừa có tác dụng gameplay vừa có giá trị hình ảnh.
- Combo theo chu kỳ khiến người xem chờ đợi "lần cắt tiếp theo sẽ là gì".

**Không nên tạo tướng mới quá giống STRING nếu:**

- Cũng đặt dây/bẫy lên tường, cắm stack vào người và có combo cycle tương tự.
- Cũng lấy fantasy "mạng nhện kiểm soát sân" làm trọng tâm.

---

### GALAXY

**Fantasy:** đấu sĩ vũ trụ, nặng, hoành tráng, thao túng không gian, hành tinh, trọng lực và khoảnh khắc ngưng đọng.

**Vai trò:** cinematic heavyweight, pressure builder, terrain splitter, burst punish.

**Cảm giác chơi/xem:**
GALAXY không nên giống một tướng nhanh. GALAXY phải có trọng lượng. Khi GALAXY tung chiêu lớn, trận đấu nên có cảm giác mọi thứ bị hút vào một khoảnh khắc định mệnh.

**Các ý tưởng core hiện có:**

- Có các trạng thái/ý tưởng như planet stacks, pressure, Divine, Impact, Bluehole.
- Pressure có thể được kích hoạt thông qua wall hits hoặc điều kiện tích lũy.
- **DIVINE** là khoảnh khắc quan trọng:
  - GALAXY áp sát/teleport vào vị trí thuận lợi.
  - Trước khi vung đòn, thế giới nên bị stop-motion rõ ràng.
  - Stop-motion phải giữ đủ lâu để người xem thấy đối thủ và mọi vật thể khác thực sự đứng yên.
  - Stop-motion nên kéo qua phần vung đấm, không kết thúc quá sớm.
  - Sau cú đấm là damage, đẩy lùi, vùng va chạm hoặc hiệu ứng parabol.
- **IMPACT** là chiêu lớn kiểu chia cắt/biến đổi chiến trường.
- **BLUEHOLE** có thể là phản ứng trọng lực/hố đen, hút, slam, hồi phục hoặc loại bỏ vật thể.
- GALAXY miễn nhiễm sát thương trong quá trình vận các chiêu lớn như DIVINE và IMPACT.
- Rage của GALAXY có thể liên quan đến giảm damage, áp lực tích lũy hoặc độ nặng của các va chạm.

**Điều GALAXY dạy cho thiết kế tướng mới:**

- Một tướng nặng cần timing khác tướng nhanh.
- Stop-motion chỉ có giá trị khi mọi thứ thật sự dừng và cú đánh hoàn tất trong nhịp đó.
- Chiêu lớn nên có sân khấu: camera/cảm giác, VFX, SFX, thời gian ngưng, rồi va chạm.

**Không nên tạo tướng mới quá giống GALAXY nếu:**

- Cũng là cosmic/gravity brawler với stop-time punch và hành tinh.
- Cũng dùng split arena + hố đen + miễn nhiễm khi cast mà không có bản sắc mới.

---

### SOCCER

**Fantasy:** cầu thủ chiến đấu, biến trận đấu thành bóng đá bạo lực. Bóng không phải trang trí; bóng là luật chơi chính.

**Vai trò:** possession fighter, precision line attacker, object control, sports-rule burst.

**Cảm giác chơi/xem:**
SOCCER phải cho cảm giác đang đá bóng thật trong một trận đấu hỗn loạn. Khi có bóng, người xem phải thấy SOCCER nguy hiểm hơn. Khi tung SHOOT, cú sút phải có hướng, lực, va chạm và hậu quả rõ ràng.

**Các ý tưởng core hiện có:**

- SOCCER bắt đầu với trạng thái dẫn bóng/possession.
- Khi đang dẫn bóng ở nửa sân dưới, SOCCER cần có cảm giác được buff: sáng hơn, có hiệu ứng tự nhiên hoặc aura gắn với asset, không phải chữ/vfx lạ không thuộc fantasy.
- Bóng tự lăn qua lại không nên gây damage lung tung. Bóng chỉ gây sát thương có ý nghĩa khi được SOCCER đá.
- Nếu bóng chạm tường sau một cú sút hụt, bóng bị disarm/freeball và không nên tự gây damage chỉ vì lần trước từng được đá.
- **SHOOT** là kỹ năng trọng tâm:
  - Điều kiện tốt nhất là SOCCER, đối thủ và khung thành nằm gần một đường thẳng.
  - Hướng sút không nên lấy từ hướng lúc bấm/kích hoạt quá sớm. Hướng nên được xác định tại khoảnh khắc phát bóng.
  - Nếu ba điểm thẳng với khung thành trên hoặc dưới, SOCCER phải tung SHOOT đúng nghĩa, không được biến thành cú đá thường damage bé.
  - SHOOT đúng phải có damage/đẩy lùi/SFX/VFX của chiêu, không giống đá thường.
  - Nếu đối thủ lệch khỏi hướng hợp lệ tối đa giữa SOCCER và khung thành, ưu tiên hướng SOCCER -> khung thành.
  - Khi SHOOT trúng đối thủ trước khi bóng chạm tường, nó có thể đẩy/carry đối thủ về hướng khung thành.
- **TOUCH KICK / one-touch kick:**
  - Trong 5 giây chờ hồi lại khả năng chuyển sang dẫn bóng, SOCCER vẫn có thể nhận bóng.
  - Nếu nhận bóng trong giai đoạn này và cửa sổ one-touch đã sẵn sàng, SOCCER lập tức đá thẳng vào đối thủ.
  - Cú đá này có hồi riêng khoảng 1 giây để tránh spam liên tục.
  - Cú đá này không reset bộ hồi 5 giây của possession. Sau 5 giây, lần nhận bóng tiếp theo nên vào dẫn bóng thay vì tiếp tục đá một chạm.
  - One-touch kick vẫn cần animation sút và quay mặt về hướng sút.
- **Penalty:**
  - Khi penalty xảy ra, vị trí đá và bóng nên được kéo/lùi xa khung thành hơn để cú sút có tốc độ và uy lực.
  - Có thể dùng slow/stop ở khoảnh khắc chạm bóng để timing vẫn rõ dù bóng bay nhanh hơn.
- **Dash/dodge:**
  - SOCCER có thể dash né nhiều đòn đánh thường/kỹ năng, đặc biệt khi Rage hoặc khi di chuyển trong sân.
  - Dash không nên né được sát thương địa hình như ICE AGE.
  - VFX dash nên rõ bằng dư ảnh từ asset, không dùng chữ hoặc hiệu ứng lạc theme.

**Điều SOCCER dạy cho thiết kế tướng mới:**

- Một vật thể phụ có thể trở thành trung tâm luật chơi.
- "Điều kiện kích hoạt" phải cực kỳ ổn định, vì người chơi sẽ cảm nhận ngay khi đáng ra phải xảy ra mà không xảy ra.
- Kỹ năng thể thao cần hướng, timing, mục tiêu và hậu quả vật lý rõ.

**Không nên tạo tướng mới quá giống SOCCER nếu:**

- Cũng dùng một quả bóng/vật thể sở hữu rồi sút vào mục tiêu/khung thành.
- Cũng xoay quanh line-up ba điểm và penalty.

---

### NINJA

**Fantasy:** sát thủ tốc độ cao, shuriken, kunai, teleport, né tránh và kết liễu bằng khoảnh khắc cực nhanh.

**Vai trò:** projectile assassin, teleport mobility, precision punish.

**Cảm giác chơi/xem:**
NINJA phải khó nắm bắt. Người xem nên thấy một kunai bay, một dấu hiệu nhỏ, rồi NINJA biến mất và xuất hiện ở vị trí nguy hiểm.

**Các ý tưởng core hiện có:**

- NINJA có shuriken bắn đều theo nhịp ngắn.
- Kunai là vật thể quan trọng:
  - Có thể được ném ra, bật tường, tồn tại một thời gian.
  - Nếu kunai chạm đối thủ, NINJA kích hoạt strike/teleport.
  - Nếu kunai hết hạn mà chưa kích hoạt, NINJA có thể teleport tới kunai.
  - NINJA có thể bắt lại kunai để reset hoặc rút ngắn cooldown.
- Khi strike, NINJA teleport cạnh mục tiêu, tạo khoảnh khắc khóa/stun ngắn, có thể có hit stop/time slow.
- NINJA có cửa sổ miễn nhiễm hoặc tự làm sạch trạng thái khi thực hiện strike.
- Rage của NINJA nên làm fantasy "không thể bắt kịp" mạnh hơn: nhiều teleport hơn, kunai nguy hiểm hơn, shuriken có tương tác tường tốt hơn.

**Điều NINJA dạy cho thiết kế tướng mới:**

- Tướng nhanh cần dấu hiệu nhỏ nhưng rõ để người xem không thấy ngẫu nhiên.
- Teleport hay khi gắn với vật thể/trước điều kiện, không chỉ blink tự do.
- Cơ chế "ném ra, đe dọa, kích hoạt hoặc thu hồi" tạo không gian chơi tốt.

**Không nên tạo tướng mới quá giống NINJA nếu:**

- Cũng là sát thủ teleport bằng dao/phóng vật, dùng kunai làm anchor.
- Cũng lấy shuriken spam + teleport strike làm loop chính.

---

## 5. Những khoảng trống thiết kế còn mở

Khi nghĩ tướng mới, nên tìm vùng fantasy chưa bị 5 core chiếm hết. Một vài hướng có thể khai thác:

- **Nhạc/rhythm:** chiêu mạnh theo nhịp beat, combo nếu va chạm đúng tempo.
- **Time/clock:** tua chậm, rewind vị trí, mark tương lai, nhưng cần khác GALAXY stop-motion.
- **Mirror/copy:** phản chiếu chiêu, tạo bản sao, đổi vị trí với bóng phản chiếu.
- **Beast/berserker:** càng bị thương càng thay đổi hành vi, không chỉ tăng damage.
- **Engineer/turret:** đặt máy móc, nhưng phải tránh làm sân quá rối hoặc lag.
- **Card/gambler:** rút lá tạo trạng thái, cần readable và không quá random.
- **Weather/storm:** mưa, sét, gió, vùng áp suất, khác ICE terrain.
- **Chef/alchemy:** nấu/tạo vật phẩm trên sân, biến pickup thành combo.
- **Magnet/metal:** hút/đẩy projectile, bẻ hướng tường, điều khiển vật thể.
- **Painter/ink:** vẽ vùng trên sân, mực lan, đòn đi theo nét vẽ.
- **Dancer/idol:** di chuyển theo pose, né bằng bước nhảy, buff/debuff theo sân khấu.
- **Monster/grab:** vật lộn, nuốt, quăng, nhưng cần phản khắc chế rõ để không quá áp bức.

AI không cần chọn những hướng trên. Đây chỉ là ví dụ về cách tìm khoảng trống.

---

## 6. Cách đánh giá một ý tưởng tướng

Ý tưởng yếu:

> Tướng gây 30 damage mỗi 3 giây và khi Rage thì gây 50 damage.

Vì sao yếu:

- Không có fantasy rõ.
- Không thay đổi luật chơi.
- Không tạo khoảnh khắc đáng nhớ.
- Không có hình ảnh/âm thanh đặc trưng.

Ý tưởng mạnh hơn:

> Tướng "BELL" đặt 3 chuông trên sân. Mỗi lần nhân vật hoặc projectile chạm chuông, chuông phát sóng âm theo hướng va chạm. Nếu 3 chuông vang trong 2 giây, BELL kích hoạt Resonance: mọi sóng âm còn lại hội tụ vào đối thủ, tạo một cú nén âm có hit stop ngắn. Rage khiến chuông có thể tự xoay mặt về vùng đông va chạm nhất, nhưng chuông bị vỡ nếu nhận 2 cú đánh mạnh.

Vì sao mạnh hơn:

- Có fantasy âm thanh rõ.
- Có vật thể riêng.
- Có setup, trigger, payoff.
- Có counterplay: phá chuông, tránh đường sóng, làm lệch timing.
- Có VFX/SFX tự nhiên.

---

## 7. Mẫu đề xuất tướng mới

Khi AI đề xuất một tướng mới, nên dùng cấu trúc này:

### Tên tướng

Tên + 1 câu fantasy.

### Vai trò

Ví dụ: control, assassin, bruiser, terrain, summoner, trapper, counter, rhythm fighter, object controller.

### Cảm giác chính

Người xem sẽ cảm thấy gì khi tướng này xuất hiện? Nặng, nhanh, hỗn loạn, tinh quái, ma thuật, đáng sợ, kỹ thuật, sân khấu?

### Vòng lặp gameplay

Tướng thường làm gì trong 5-10 giây combat?

Ví dụ:

1. Đặt dấu ấn.
2. Ép đối thủ đi qua vùng nguy hiểm.
3. Tích đủ 3 stack.
4. Tung chiêu lớn nếu điều kiện đúng.

### Kỹ năng chính

Mô tả trigger, windup, release, impact và aftermath.

### Rage

Rage thay đổi luật chơi thế nào? Nó phải khuếch đại fantasy, không chỉ cộng damage.

### Resource/HUD

Tướng có cần stack, thanh charge, số vật thể sống, cooldown đặc biệt, nhịp beat, mức nhiệt, v.v. không?

### VFX/SFX

Hiệu ứng nên đi từ asset/fantasy của tướng. Tránh thêm chữ lớn hoặc hiệu ứng lạ nếu không thuộc bản sắc.

### Counterplay

Đối thủ có thể né, phá, trì hoãn, bait, kéo lệch, ép tường, hoặc làm chiêu thất bại bằng cách nào?

### Matchup với 5 core

Nói ngắn gọn tướng này tương tác ra sao với:

- ICE.
- STRING.
- GALAXY.
- SOCCER.
- NINJA.

### Rủi ro thiết kế

Ý tưởng này có thể bị quá rối, quá random, quá giống tướng cũ, quá lag, hoặc khó đọc ở điểm nào?

---

## 8. Quy tắc về VFX/SFX và độ rõ

APEX CHAOS cần giữ độ chi tiết, VFX và SFX. Không nên giải quyết vấn đề bằng cách xóa hiệu ứng hay làm chiêu mất chất.

Nhưng hiệu ứng phải phục vụ đọc trận:

- Chiêu lớn cần windup rõ.
- Va chạm mạnh cần âm thanh, hit stop hoặc flash hợp lý.
- Sát thương lớn nên có cảm giác mất máu mạnh, ví dụ vùng máu trắng mất đi fade lâu và rõ.
- VFX không nên che nhân vật/mục tiêu quá lâu nếu nó làm người xem không hiểu chuyện gì xảy ra.
- VFX nên gắn với asset/fantasy. Với SOCCER, ưu tiên dư ảnh, bóng, sân, lực sút, aura vận động; tránh chữ hoặc hiệu ứng không thuộc bóng đá.
- Với ICE, mũi tên băng cần hướng, vị trí và đường bay hợp lý.
- Với GALAXY, stop-motion phải thật sự làm các vật thể khác đứng yên trong khoảnh khắc cần thiết.

---

## 9. Những điều không nên đề xuất

- Tướng chỉ tăng damage/tốc độ mà không có luật riêng.
- Tướng dùng cùng fantasy với core hiện tại mà không có twist lớn.
- Chiêu kích hoạt quá ngẫu nhiên khiến người xem không hiểu.
- VFX không liên quan đến tướng.
- Cơ chế phải đọc chữ trên màn hình mới hiểu.
- Skill quá nhiều tầng nhưng không có khoảnh khắc biểu tượng.
- Ý tưởng làm mất VFX/SFX/độ chi tiết hiện tại để tối ưu.
- Tướng mới khiến một core hiện tại mất bản sắc, ví dụ một tướng cũng chơi bóng tốt hơn SOCCER hoặc cũng stop-time punch hoành tráng hơn GALAXY.

---

## 10. Câu hỏi AI nên tự hỏi khi lên ý tưởng

- Nếu bỏ tên tướng đi, người xem còn nhận ra fantasy không?
- Tướng này làm trận đấu khác đi bằng cách nào?
- Khoảnh khắc "wow" là gì?
- Có điều kiện nào khiến chiêu mạnh bị hụt không?
- Người xem có hiểu vì sao chiêu kích hoạt không?
- Rage có làm tướng đúng chất hơn không?
- Ý tưởng này khác ICE/STRING/GALAXY/SOCCER/NINJA ở đâu?
- VFX/SFX nên xuất phát từ asset nào?
- Nếu trận kéo dài 60 giây, tướng này có tạo nhịp điệu thú vị hay chỉ spam một hành động?

---

## 11. Prompt gợi ý cho AI lên ý tưởng

Bạn là AI đồng thiết kế tướng cho APEX CHAOS. Hãy đề xuất một tướng mới không trùng fantasy với ICE, STRING, GALAXY, SOCCER, NINJA.

Yêu cầu:

- Mô tả fantasy và cảm giác combat.
- Nêu vòng lặp gameplay trong 5-10 giây.
- Tạo ít nhất 1 kỹ năng signature có windup, release, impact, aftermath.
- Nêu Rage khuếch đại bản sắc thế nào.
- Nêu HUD/resource nếu cần.
- Nêu VFX/SFX nên trông/nghe ra sao.
- Nêu counterplay và rủi ro thiết kế.
- So sánh matchup ngắn với 5 tướng core.

Không cần viết code. Tập trung vào ý tưởng, cảm giác, luật chơi, độ rõ hình ảnh và khoảnh khắc đáng nhớ.
