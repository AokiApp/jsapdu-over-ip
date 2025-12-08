package app.aoki.quarkuscrud.mapper;

import app.aoki.quarkuscrud.entity.Cardhost;
import java.util.List;
import java.util.Optional;
import org.apache.ibatis.annotations.*;

/**
 * MyBatis mapper for Cardhost entity
 * 
 * Provides database access for cardhost registry.
 * Uses annotation-based configuration per quarkus-crud template pattern.
 */
@Mapper
public interface CardhostMapper {

  @Insert(
      "INSERT INTO cardhosts (uuid, public_key, name, status, first_seen, last_seen, connection_count, created_at, updated_at) "
          + "VALUES (#{uuid}, #{publicKey}, #{name}, #{status}, #{firstSeen}, #{lastSeen}, #{connectionCount}, #{createdAt}, #{updatedAt})")
  @Options(useGeneratedKeys = true, keyProperty = "id")
  void insert(Cardhost cardhost);

  @Select("SELECT * FROM cardhosts WHERE uuid = #{uuid}")
  Optional<Cardhost> findByUuid(@Param("uuid") String uuid);

  @Select("SELECT * FROM cardhosts WHERE status = #{status}")
  List<Cardhost> findByStatus(@Param("status") String status);

  @Select("SELECT * FROM cardhosts")
  List<Cardhost> findAll();

  @Update(
      "UPDATE cardhosts SET "
          + "public_key = #{publicKey}, "
          + "name = #{name}, "
          + "status = #{status}, "
          + "last_seen = #{lastSeen}, "
          + "connection_count = #{connectionCount}, "
          + "updated_at = #{updatedAt} "
          + "WHERE id = #{id}")
  void update(Cardhost cardhost);

  @Delete("DELETE FROM cardhosts WHERE id = #{id}")
  void deleteById(@Param("id") Long id);
}
